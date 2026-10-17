// Lets background analysis run on all fixture games inside a persistent profile.
import { launch } from './mock.mjs';
const profile = process.argv[2];
const { browser, page } = await launch({ profile });
await page.goto('http://localhost:5173/');
await page.waitForSelector('main li');
await page.evaluate(async () => {
  const req = indexedDB.open('chess-review-katileasy');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  await new Promise((r) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ depth: 16, autoAnalyze: true, autoMaxPerSession: 1000 }, 'settings'); tx.oncomplete = r; });
});
await page.reload();
// load all months
for (let i = 0; i < 6; i++) { const b = page.locator('text=Load older games'); if (await b.count()) { await b.click(); await page.waitForTimeout(800); } }
await page.reload();
const start = Date.now();
for (;;) {
  await page.waitForTimeout(10000);
  const txt = await page.locator('header').first().innerText();
  console.log(Math.round((Date.now() - start) / 1000) + 's', txt.replace(/\n/g, ' '));
  if (!/Analyzing/.test(txt)) break;
}
await browser.close();
