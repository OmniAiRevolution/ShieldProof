const { chromium } = require('playwright');
const fs = require('fs');
const { pathToFileURL } = require('url');
(async () => {
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  let failures = [];
  for (const width of [375, 1280]) {
    const page = await browser.newPage({viewport:{width,height:812}, reducedMotion:'reduce'});
    // No live services, purchases or external calls during smoke tests.
    await page.route('http**://**/*', route => route.abort());
    const exceptions = [];
    page.on('pageerror', e => exceptions.push(String(e)));
    try {
      await page.goto(pathToFileURL(process.cwd()+'/index.html').href, {waitUntil:'domcontentloaded',timeout:20000});
      await page.waitForTimeout(1200);
      const data = await page.evaluate(() => ({
        title:document.title,
        bodyText:document.body.innerText.trim().length,
        buttons:document.querySelectorAll('button').length,
        overflow:document.documentElement.scrollWidth-innerWidth,
        cssMarker:Array.from(document.styleSheets).some(s => {try{return Array.from(s.cssRules).some(r=>r.cssText.includes('AITECHPRO V10'))}catch{return false}}),
        mainVisible:!!document.body && getComputedStyle(document.body).display!=='none'
      }));
      console.log(width,JSON.stringify(data),'pageerrors:',exceptions.slice(0,4));
      if (!data.title || data.bodyText<30 || !data.buttons || !data.mainVisible) failures.push(width+': missing UI');
      if (data.overflow>20) failures.push(width+': horizontal overflow '+data.overflow);
      await page.screenshot({path:'v10-'+width+'.png',fullPage:true});
    } catch(e) {failures.push(width+': '+e.message)}
    await page.close();
  }
  await browser.close();
  if(failures.length){console.error(failures.join('\n'));process.exit(1)}
  console.log('PASS: mobile and desktop offline smoke checks');
})().catch(e=>{console.error(e);process.exit(1)});
