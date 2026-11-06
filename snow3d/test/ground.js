// Autotest del terreno: deve passare normalmente e, se la neve sparisce, deve ripararsi da solo.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 160 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForFunction(() => window.__pr && window.__pr.state === 'menu', null, { timeout: 90000 });
  console.log('normale:', await page.evaluate(() => __pr.DIAG.ground + ' tipo ' + __pr.snowMat().type));
  // simulo un telefono che non disegna la neve: il materiale non scrive colore
  console.log('guasto simulato:', await page.evaluate(() => { const m = __pr.snowMat(); m.colorWrite = false; __pr.groundSelfTest(); return __pr.DIAG.ground + ' tipo ' + __pr.snowMat().type; }));
  await browser.close();
})();
