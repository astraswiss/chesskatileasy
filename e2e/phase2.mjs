import { launch } from './mock.mjs';
const BASE = process.env.APP_URL ?? 'http://localhost:5173/';
const OUT = process.argv[2] ?? '.';
const { browser, page, errors } = await launch({ mobile: process.env.DESKTOP ? false : true });
await page.goto(BASE);
await page.waitForSelector('main li');
await page.locator('main li button').first().click();
await page.waitForSelector('text=Analyze game');
await page.waitForTimeout(1500); // live eval
await page.screenshot({ path: `${OUT}/p2-review-live.png` });
const t0 = Date.now();
await page.click('text=Analyze game');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/p2-progress.png` });
// UI responsiveness check while analyzing: measure a frame gap
const gap = await page.evaluate(() => new Promise((res) => { let max = 0, last = performance.now(), n = 0; function f(t) { max = Math.max(max, t - last); last = t; if (++n < 60) requestAnimationFrame(f); else res(max); } requestAnimationFrame(f); }));
console.log('max frame gap during analysis (ms):', Math.round(gap));
await page.waitForSelector('text=Accuracy', { timeout: 180000 });
console.log('analysis took', Date.now() - t0, 'ms');
await page.click('[aria-label="Next move"]');
for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/p2-review-analyzed.png`, fullPage: true });
console.log('errors', errors);
await browser.close();
