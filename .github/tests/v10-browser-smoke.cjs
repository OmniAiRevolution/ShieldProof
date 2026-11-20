const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const failures=[];
 const checks=[[375,'no-preference'],[375,'reduce'],[1280,'no-preference']];
 for(const [width,motion] of checks){
  const page=await browser.newPage({viewport:{width,height:812},reducedMotion:motion,deviceScaleFactor:1});
  await page.route(/^https?:\/\//,route=>route.abort());
  const exceptions=[];
  page.on('pageerror',e=>exceptions.push(String(e)));
  try{
   await page.goto(pathToFileURL(process.cwd()+'/index.html').href,{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForTimeout(900);
   const data=await page.evaluate(()=>{
    const canvas=document.getElementById('spatial-canvas');
    const nav=document.querySelector('nav.floating-dock');
    const hero=document.querySelector('.v10-sell-hero, .v10-security-overview');
    return {
      title:document.title,
      bodyText:document.body.innerText.trim().length,
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      canvasReady:canvas?.dataset.spatialReady==='1',
      canvasWidth:canvas?.width??0,
      canvasHeight:canvas?.height??0,
      spatialApi:typeof window.setSpatialState==='function',
      modernCSS:!!document.querySelector('link[href="./modern-ui.css"]'),
      spatialCSS:!!document.querySelector('link[href="./spatial-ui.css"]'),
      cards:document.querySelectorAll('.glass-card-3d').length,
      heroVisible:!!hero&&hero.getBoundingClientRect().height>150,
      dock:nav?getComputedStyle(nav).position:null,
      input:!!document.getElementById('image-input')||!!document.getElementById('scan-input')
    };
   });
   console.log('V10 SPATIAL',width,motion,JSON.stringify(data),'pageerrors:',exceptions.slice(0,3));
   if(!data.title||data.bodyText<100||!data.input||!data.heroVisible||!data.spatialApi||!data.canvasReady||data.canvasWidth<100||data.canvasHeight<100||!data.modernCSS||!data.spatialCSS||data.cards<3)failures.push(width+'/'+motion+' missing interactive spatial UI');
   if(data.dock!=='fixed')failures.push(width+'/'+motion+' dock position '+data.dock);
   if(data.overflow>20)failures.push(width+'/'+motion+' overflow '+data.overflow);
   if(exceptions.length)failures.push(width+'/'+motion+' runtime errors '+exceptions.slice(0,2).join(';'));
   if(width===375&&motion==='no-preference'){
     const sell=await page.locator('#image-input').count();
     if(sell){
       await page.locator('.v10-secondary-action[onclick="setStudioStep(2)"]').click();
       if(await page.locator('#studio-step-2').evaluate(el=>el.classList.contains('hidden')))failures.push('Sell Smart details navigation failed');
     }else{
       await page.getByRole('button',{name:/Lancer une analyse/i}).click();
       if(await page.locator('#view-scan').evaluate(el=>el.classList.contains('hidden')))failures.push('ShieldProof scan navigation failed');
     }
   }
   await page.screenshot({path:'v10-spatial-'+width+'-'+motion+'.png',fullPage:true});
  }catch(e){failures.push(width+'/'+motion+': '+e.message)}
  await page.close();
 }
 await browser.close();
 if(failures.length){console.error(failures.join('\n'));process.exit(1)}
 console.log('PASS: spatial UI, offline browser, reduced motion and navigation');
})().catch(e=>{console.error(e);process.exit(1)});
