const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 300 } });
  page.on('pageerror', e => console.log('pageerror:', e.message, e.stack.split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 600)); });
  await page.goto('file://' + path.resolve(__dirname, '../../snow/powder.html'));
  await page.waitForTimeout(20000);
  console.log('stato', await page.evaluate(() => window.__pr && window.__pr.state));
  await browser.close();
})();
