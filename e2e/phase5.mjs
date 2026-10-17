import { launch } from './mock.mjs';
const BASE = process.env.APP_URL ?? 'http://localhost:5173/';
const OUT = process.argv[2] ?? '.';
const { browser, page, errors } = await launch();
await page.goto(BASE);
await page.waitForSelector('text=/Analyzing \\d+\\/\\d+/', { timeout: 15000 });
console.log('indicator:', await page.locator('text=/Analyzing \\d+\\/\\d+/').innerText());
await page.screenshot({ path: `${OUT}/p5-indicator.png` });
// simulate app hidden
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(500);
console.log('hidden ->', await page.locator('text=/Paused \\d+/').count() ? 'paused' : 'NOT paused');
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForFunction(() => /Analyzing 3\//.test(document.body.innerText), null, { timeout: 120000 });
console.log('now:', await page.locator('text=/Analyzing \\d+\\/\\d+/').innerText());
console.log('accuracies shown:', await page.locator('main li .tabular-nums.text-lg').count());
const tags = await page.evaluate(async () => {
  const req = indexedDB.open('chess-review-katileasy');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const all = await new Promise((r) => { const q = db.transaction('analyses').objectStore('analyses').getAll(); q.onsuccess = () => r(q.result); });
  const c = {}; let mine = 0;
  for (const a of all) for (const m of a.moves) if (m.color === a.myColor) { mine++; for (const t of m.tags) c[t] = (c[t] || 0) + 1; }
  const sample = all[0].moves.find((m) => m.color === all[0].myColor && m.tags.length);
  return { games: all.length, mine, c, sample: sample && { ...sample, fenBefore: undefined } };
});
console.log(JSON.stringify(tags, null, 1));
console.log('errors', errors);
await browser.close();
