/* SHIELDPROOF V10.1 — C2PA validation + certificate signatures
 * Official browser SDK: @contentauth/c2pa-web 0.15.4
 * Local ECDSA key: integrity signature, NOT proof of civil identity.
 */
let spC2paRuntime = null;

async function shieldProofValidateC2PA(file) {
  const mod = await import("https://esm.sh/@contentauth/c2pa-web@0.15.4");
  if (!spC2paRuntime) {
    spC2paRuntime = await mod.createC2pa({
      wasmSrc: "https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/dist/resources/c2pa_bg.wasm"
    });
  }
  const reader = await mod.Reader.fromBlob(spC2paRuntime, file.type || undefined, file);
  try {
    const store = await reader.manifestStore();
    if (!store) return { state: "NO_MANIFEST", message: "Aucun manifeste C2PA lisible." };
    return {
      state: store.validation_state || "UNKNOWN",
      activeManifest: store.active_manifest || null,
      validationResults: store.validation_results || null,
      validationStatus: store.validation_status || []
    };
  } finally {
    await reader.free();
  }
}

function shieldProofOpenDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("shieldproof-forensic-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("seals", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function shieldProofGetOrCreateSigningKey() {
  const db = await shieldProofOpenDB();
  const existing = await new Promise((resolve, reject) => {
    const req = db.transaction("seals").objectStore("seals").get("__device_signing_key__");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (existing?.privateKey && existing?.publicKey) return existing;
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]
  );
  await new Promise((resolve, reject) => {
    const tx = db.transaction("seals", "readwrite");
    tx.objectStore("seals").put({ id: "__device_signing_key__", privateKey: pair.privateKey, publicKey: pair.publicKey });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return pair;
}

function shieldProofBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function shieldProofSignCertificate(certificate) {
  const keys = await shieldProofGetOrCreateSigningKey();
  const payload = { ...certificate };
  delete payload.signature;
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const signed = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, bytes);
  return {
    ...payload,
    signature: {
      algorithm: "ECDSA-P256-SHA256",
      publicKey: await crypto.subtle.exportKey("jwk", keys.publicKey),
      value: shieldProofBase64(signed),
      scope: "integrity-only-not-identity"
    }
  };
}

async function shieldProofVerifyCertificate(certificate) {
  const signature = certificate?.signature;
  if (!signature || signature.algorithm !== "ECDSA-P256-SHA256") return false;
  const payload = { ...certificate };
  delete payload.signature;
  const key = await crypto.subtle.importKey(
    "jwk", signature.publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
  );
  const bytes = Uint8Array.from(atob(signature.value), c => c.charCodeAt(0));
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" }, key, bytes,
    new TextEncoder().encode(JSON.stringify(payload))
  );
}

/*
 * TRUST MODEL:
 * - The self-generated public key proves only that this certificate matches
 *   its attached signature. A malicious person can generate another key.
 * - To prove an organization/person identity, a trusted CA or server-held
 *   signing key and account verification are required.
 * - This file does not implement independent timestamping or AI pixel
 *   classification. Do not display those functions as available.
 */
