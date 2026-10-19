import { launch } from './mock.mjs';
const OUT = process.argv[3] ?? '.';
const { browser, page, errors } = await launch({ profile: process.argv[2] });
await page.goto('http://localhost:5173/#/openings');
await page.waitForSelector("text=Queen's Gambit", { timeout: 20000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/o1-overview.png` });
await page.locator('main button', { hasText: "Queen's Gambit" }).first().click();
await page.waitForSelector('text=Explorer');
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/o2-detail.png`, fullPage: true });
// walk the explorer a few plies
for (let i = 0; i < 4; i++) {
  const b = page.locator('button:has(span:text("›"))').first();
  if (!(await b.count())) break;
  await b.click();
  await page.waitForTimeout(250);
}
const exp = page.locator('text=Explorer').locator('xpath=following-sibling::*[1]');
await exp.screenshot({ path: `${OUT}/o3-explorer.png` });
console.log('explorer text:', (await exp.innerText()).replace(/\n/g, ' | ').slice(0, 400));
await page.click('text=Practice these positions');
await page.waitForTimeout(1000);
console.log('puzzle filter:', await page.locator("text=Only positions from your").count(), 'board:', await page.locator('text=Find the best move').count());
console.log('errors', errors);
await browser.close();
