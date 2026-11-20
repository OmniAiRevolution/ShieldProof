/* AITECHPRO V10 Spatial — self-contained Canvas 2D projected 3D, zero dependencies.
   Decorative only. Does not read files, inspect user data or change app logic. */
(() => {
  'use strict';
  const canvas = document.getElementById('spatial-canvas');
  if (!canvas || canvas.dataset.spatialReady === '1') return;
  const ctx = canvas.getContext('2d', {alpha:true, desynchronized:true});
  if (!ctx) return;
  canvas.dataset.spatialReady = '1';
  const shield = document.documentElement.dataset.theme === 'shieldproof';
  const host = canvas.closest('.v10-sell-hero, .v10-security-overview');
  if (!host) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const tint = shield ? '#53efc0' : '#b98aff';
  const second = shield ? '#62c6ff' : '#f1a1e7';
  let state = 'idle', nextState = null, until = 0, raf = 0, width = 0, height = 0, pixelRatio = 1;
  let time = 0, pointer = [0, 0], target = [0, 0], visible = true, lastFrame = 0;
  const pointCount = shield ? 32 : 25;
  const nodes = Array.from({length:pointCount}, (_,i) => {
    const y = 1 - (i / (pointCount - 1)) * 2, r = Math.sqrt(Math.max(0, 1-y*y)), a = i*2.3999632297;
    return [Math.cos(a)*r, y, Math.sin(a)*r];
  });
  window.setSpatialState = function (value) {
    if (!['idle', 'scanning', 'success'].includes(value)) return;
    state = value;
    until = value === 'success' ? performance.now() + 3100 : 0;
    if (visible && !reduce.matches) start();
  };
  function measure() {
    const b = host.getBoundingClientRect();
    if (!b.width || !b.height) return;
    pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.round(b.width));
    height = Math.max(1, Math.round(b.height));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    if (reduce.matches) draw();
  }
  function project([x,y,z],rx,ry,base) {
    const sinY=Math.sin(ry), cosY=Math.cos(ry), sinX=Math.sin(rx), cosX=Math.cos(rx);
    const dx=x*cosY-z*sinY, zz=z*cosY+x*sinY;
    const dy=y*cosX-zz*sinX, depth=zz*cosX+y*sinX;
    const scale=3/(3+depth*.42);
    return [base[0]+dx*base[2]*scale, base[1]+dy*base[2]*scale,scale];
  }
  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0,0,width,height);
    const mobile=width<740;
    const rad=Math.min(width*(mobile?.21:.2),height*(mobile?.25:.35),mobile?95:145);
    const center=[width*(mobile?.79:.84), height*(mobile?.24:.51),rad];
    const rotX=time*.35+pointer[1]*.3, rotY=time+pointer[0]*.55;
    const main=state==='success'?'#73f2b1':tint;
    ctx.save();
    ctx.lineWidth=1.1;
    for (let ring=0;ring<3;ring++) {
      ctx.beginPath();
      for(let i=0;i<=72;i++) {
        const t=i/72*Math.PI*2;
        const p=project([Math.cos(t)*(1.25+ring*.17),Math.sin(t)*(.24+ring*.10),Math.sin(t)*(1.15+ring*.1)],rotX+ring*.55,rotY*(ring%2?-1:1),center);
        if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);
      }
      ctx.strokeStyle=ring===1?second:main;
      ctx.globalAlpha=state==='scanning'?.52:.27;
      ctx.stroke();
    }
    const points=nodes.map(n=>project(n,rotX,rotY,center));
    ctx.strokeStyle=main;
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
      const d=Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1]);
      if(d<rad*.68) {
        ctx.globalAlpha=(1-d/(rad*.68))*(state==='scanning'?.45:.29);
        ctx.beginPath();ctx.moveTo(points[i][0],points[i][1]);ctx.lineTo(points[j][0],points[j][1]);ctx.stroke();
      }
    }
    points.forEach(p=>{
      ctx.beginPath();ctx.arc(p[0],p[1],Math.max(.85,1.55*p[2]),0,Math.PI*2);
      ctx.globalAlpha=.45;ctx.fillStyle=main;ctx.fill();
    });
    ctx.restore();
  }
  function step(ts) {
    raf=0;
    if (!visible || reduce.matches || document.hidden) return;
    if (ts-lastFrame<30){start();return;}
    lastFrame=ts;
    if(until && ts>until){state='idle';until=0;}
    time += state==='scanning'?.055:.012;
    pointer[0] += (target[0]-pointer[0])*.06;
    pointer[1] += (target[1]-pointer[1])*.06;
    draw();start();
  }
  function start(){if (!raf&&!reduce.matches&&visible&&!document.hidden)raf=requestAnimationFrame(step);}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  const observer=new IntersectionObserver(entries=>{
    visible=entries[0]?.isIntersecting ?? true;
    if(visible)start();else stop();
  },{threshold:.01});
  observer.observe(host);
  const resizeObserver=new ResizeObserver(measure);resizeObserver.observe(host);
  host.addEventListener('pointermove',e=>{
    if(reduce.matches)return;
    const r=host.getBoundingClientRect();
    target=[Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2)),Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-.5)*2))];
  },{passive:true});
  host.addEventListener('pointerleave',()=>{target=[0,0]},{passive:true});
  // Sensor access is opt-in. Mobile browsers may require HTTPS and a user gesture.
  const sensorButton=document.getElementById('v10-motion-toggle');
  if(sensorButton && 'DeviceOrientationEvent' in window) {
    sensorButton.hidden=false;
    sensorButton.addEventListener('click',async()=>{
      try {
        if(typeof DeviceOrientationEvent.requestPermission === 'function') {
          const permission=await DeviceOrientationEvent.requestPermission();
          if(permission !== 'granted') throw new Error('permission denied');
        }
        window.addEventListener('deviceorientation',event=>{
          if(document.hidden||reduce.matches||!visible)return;
          if(typeof event.gamma!=='number'||typeof event.beta!=='number')return;
          target=[
            Math.max(-1,Math.min(1,event.gamma/30)),
            Math.max(-1,Math.min(1,(event.beta-45)/40))
          ];
        },{passive:true});
        sensorButton.textContent='Gyroscope activé';
        sensorButton.disabled=true;
      } catch {
        sensorButton.textContent='Gyroscope indisponible';
        sensorButton.disabled=true;
      }
    });
  }
  const cards=Array.from(document.querySelectorAll('.glass-card-3d'));
  cards.forEach(card=>{
    card.addEventListener('pointermove',e=>{
      if(reduce.matches||e.pointerType==='touch')return;
      const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      card.style.setProperty('--spatial-x',Math.round(x*100)+'%');
      card.style.setProperty('--spatial-y',Math.round(y*100)+'%');
      card.style.setProperty('--spatial-rx',((.5-y)*4).toFixed(2)+'deg');
      card.style.setProperty('--spatial-ry',((x-.5)*4).toFixed(2)+'deg');
    },{passive:true});
    card.addEventListener('pointerleave',()=>{
      card.style.removeProperty('--spatial-rx');card.style.removeProperty('--spatial-ry');
      card.style.removeProperty('--spatial-x');card.style.removeProperty('--spatial-y');
    },{passive:true});
  });
  // In-app UI signals are non-invasive: do not alter existing callbacks or promise results.
  if(!shield) {
    document.getElementById('btn-analyze')?.addEventListener('click',()=>window.setSpatialState('scanning'));
    const result=document.getElementById('ai-suggestions');
    if(result) new MutationObserver(()=>{
      if(state==='scanning'&&result.querySelectorAll('.chip,.suggestion,.suggestion-item,button').length)window.setSpatialState('success');
    }).observe(result,{childList:true,subtree:true});
    document.querySelectorAll('[onclick="generateListing()"]').forEach(btn=>btn.addEventListener('click',()=>{
      queueMicrotask(()=>{
        const title=document.getElementById('res-title');
        if(title&&title.value.trim())window.setSpatialState('success');
      });
    }));
  } else {
    const scan=document.getElementById('scan-input');
    scan?.addEventListener('change',()=>{if(scan.files?.length)window.setSpatialState('scanning')});
    const result=document.getElementById('scan-result');
    if(result)new MutationObserver(()=>{
      if(!result.classList.contains('hidden') && state==='scanning')window.setSpatialState('success');
    }).observe(result,{attributes:true,attributeFilter:['class']});
  }
  reduce.addEventListener?.('change',()=>{if(reduce.matches){stop();time=0;draw()}else start()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start()});
  measure();
  if(reduce.matches)draw();else start();
})();
