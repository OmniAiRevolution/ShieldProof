/* SHIELDPROOF V10 — cryptographic enrichment, OpenTimestamps and C2PA reader.
   No photo bytes are uploaded by timestamping: only the SHA-256 digest is sent.
   Browser signatures prove local certificate integrity, NOT legal identity. */
(function () {
  'use strict';
  const DB_NAME = 'shieldproof_db';
  const DB_VERSION = 2;
  const OTS_CALENDARS = [
    'https://alice.btc.calendar.opentimestamps.org',
    'https://bob.btc.calendar.opentimestamps.org',
    'https://finney.calendar.eternitywall.com'
  ];
  const withTimeout = (p, ms, label) => Promise.race([
    p, new Promise((_, reject) => setTimeout(() => reject(new Error(label + '_TIMEOUT')), ms))
  ]);
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('subs')) db.createObjectStore('subs', {keyPath:'id'});
        if (!db.objectStoreNames.contains('proofs')) db.createObjectStore('proofs', {keyPath:'id'});
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', {keyPath:'id'});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function getStore(store, id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function putStore(store, item) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  }
  async function getDeviceKey() {
    let entry = await getStore('keys', 'device-ecdsa-p256');
    if (entry && entry.privateKey && entry.publicKey) return entry;
    const pair = await crypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'}, false, ['sign','verify']);
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    entry = {id:'device-ecdsa-p256', privateKey:pair.privateKey, publicKey:pair.publicKey, publicJwk, createdAt:new Date().toISOString()};
    await putStore('keys', entry);
    return entry;
  }
  const bytesToBase64 = bytes => {
    let bin = '';
    for (let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  const base64ToBytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function signCertificate(proof) {
    const keys = await getDeviceKey();
    const payload = {
      certId: proof.certId, hash: proof.hash, timestamp: proof.timestamp,
      title: proof.title, category: proof.cat, aiScore: proof.aiScore || 0,
      otsStatus: proof.otsStatus || 'not_requested'
    };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const signature = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, keys.privateKey, data);
    return {
      algorithm:'ECDSA-P256-SHA256', payload, signatureBase64:bytesToBase64(new Uint8Array(signature)),
      publicJwk:keys.publicJwk, keyCreatedAt:keys.createdAt,
      scope:'device-integrity-only-not-identity'
    };
  }
  async function verifyCertificateSignature(signatureRecord) {
    if (!signatureRecord || !signatureRecord.publicJwk || !signatureRecord.signatureBase64 || !signatureRecord.payload) return false;
    const publicKey = await crypto.subtle.importKey('jwk', signatureRecord.publicJwk,
      {name:'ECDSA', namedCurve:'P-256'}, true, ['verify']);
    return crypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, publicKey,
      base64ToBytes(signatureRecord.signatureBase64),
      new TextEncoder().encode(JSON.stringify(signatureRecord.payload)));
  }
  async function submitOpenTimestamp(hash) {
    if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Invalid SHA-256 digest');
    const digest = Uint8Array.from(hash.match(/.{2}/g), x => parseInt(x,16));
    const results = await Promise.allSettled(OTS_CALENDARS.map(async calendar => {
      const response = await withTimeout(fetch(calendar + '/digest', {
        method:'POST',
        mode:'cors',
        headers:{'Accept':'application/vnd.opentimestamps.v1','Content-Type':'application/x-www-form-urlencoded'},
        body:digest
      }), 8000, 'OTS');
      if (!response.ok) throw new Error(calendar + ' HTTP ' + response.status);
      const receipt = new Uint8Array(await response.arrayBuffer());
      if (!receipt.length) throw new Error('Empty OTS receipt');
      return {calendar, proofBase64:bytesToBase64(receipt), receivedAt:new Date().toISOString()};
    }));
    return results.filter(x => x.status === 'fulfilled').map(x => x.value);
  }
  async function enrichSavedProof(id) {
    const proof = await getStore('proofs', id);
    if (!proof) return;
    try {
      proof.signature = await signCertificate(proof);
      proof.signatureStatus = 'signed';
    } catch (e) {
      proof.signatureStatus = 'unavailable';
      proof.signatureError = String(e && e.message || e);
    }
    try {
      const receipts = await submitOpenTimestamp(proof.hash);
      proof.otsReceipts = receipts;
      proof.otsStatus = receipts.length ? 'pending_bitcoin_confirmation' : 'unavailable';
      proof.otsRequestedAt = new Date().toISOString();
    } catch (e) {
      proof.otsReceipts = [];
      proof.otsStatus = 'unavailable';
      proof.otsError = String(e && e.message || e);
    }
    await putStore('proofs', proof);
    if (typeof window.renderProofs === 'function') window.renderProofs().catch(()=>{});
  }
  let c2paInstancePromise = null;
  async function getC2pa() {
    if (c2paInstancePromise) return c2paInstancePromise;
    c2paInstancePromise = (async () => {
      let sdk;
      try { sdk = await import('./vendor/c2pa-web/index.js'); }
      catch (_) { sdk = await import('https://esm.sh/@contentauth/c2pa-web@0.15.4'); }
      let wasmSrc = './vendor/c2pa-web/c2pa_bg.wasm';
      try {
        const head = await fetch(wasmSrc, {method:'HEAD'});
        if (!head.ok) throw new Error('local wasm unavailable');
      } catch (_) {
        wasmSrc = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/dist/resources/c2pa_bg.wasm';
      }
      const c2pa = await sdk.createC2pa({wasmSrc});
      return {sdk, c2pa};
    })();
    try { return await c2paInstancePromise; }
    catch (e) { c2paInstancePromise = null; throw e; }
  }
  async function inspectC2PA(file) {
    const {sdk, c2pa} = await withTimeout(getC2pa(), 20000, 'C2PA_INIT');
    const reader = await withTimeout(sdk.Reader.fromBlob(c2pa, file.type || '', file), 20000, 'C2PA_READ');
    try {
      const store = await reader.manifestStore();
      const active = store && store.active_manifest ? store.active_manifest : null;
      const status = active && active.validation_status ? active.validation_status : [];
      return {
        present:Boolean(active || (store && store.manifests && Object.keys(store.manifests).length)),
        activeLabel:active && active.label ? active.label : null,
        validationStatus:status,
        summary:active ? 'Manifeste C2PA trouvé. Examiner les statuts de validation.' : 'Aucun manifeste C2PA trouvé dans ce fichier.',
        rawAvailable:Boolean(store)
      };
    } finally {
      try { await reader.free(); } catch (_) {}
    }
  }
  async function runC2paCheck() {
    const statusEl = document.getElementById('c2pa-status');
    if (!window.currentScan || !window.currentScan.file) {
      if (statusEl) statusEl.textContent = 'Scanne d’abord une image.';
      return;
    }
    if (statusEl) statusEl.textContent = 'Lecture des Content Credentials C2PA…';
    try {
      const result = await inspectC2PA(window.currentScan.file);
      window.currentScan.c2paStatus = result;
      if (statusEl) statusEl.textContent = result.summary + (result.validationStatus && result.validationStatus.length ? ' Statuts : ' + result.validationStatus.map(x => x.code || x).join(', ') : '');
    } catch (e) {
      window.currentScan.c2paStatus = {error:String(e && e.message || e)};
      if (statusEl) statusEl.textContent = 'Vérification C2PA indisponible : ' + String(e && e.message || e);
    }
  }
  async function verifySavedSignature(id) {
    const p = await getStore('proofs', id);
    const ok = p && await verifyCertificateSignature(p.signature);
    if (typeof window.toast === 'function') window.toast(ok ? 'Signature locale du certificat valide (intégrité uniquement).' : 'Signature absente ou invalide.');
    return Boolean(ok);
  }
  async function downloadOTSReceipt(id) {
    const p = await getStore('proofs', id);
    if (!p || !p.otsReceipts || !p.otsReceipts.length) {
      if (typeof window.toast === 'function') window.toast('Aucun reçu OpenTimestamps disponible.');
      return;
    }
    const receipt = base64ToBytes(p.otsReceipts[0].proofBase64);
    const blob = new Blob([receipt], {type:'application/vnd.opentimestamps'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = p.certId + '.ots'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }
  window.shieldProofV10 = {enrichSavedProof, verifyCertificateSignature, verifySavedSignature, downloadOTSReceipt, inspectC2PA};
  window.runC2paCheck = runC2paCheck;
  window.verifySavedProofSignature = verifySavedSignature;
  window.downloadOTSReceipt = downloadOTSReceipt;
})();