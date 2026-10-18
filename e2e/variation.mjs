// Moves pieces on the review board (tap-tap and drag) to explore a variation.
import { launch } from './mock.mjs';
import { Chess } from 'chess.js';
const OUT = process.argv[3] ?? '.';
const { browser, page, errors } = await launch({ profile: process.argv[2] });
await page.goto('http://localhost:5173/#/game/fixture-0003?ply=12');
await page.waitForSelector('[aria-label="Next move"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/v0-review.png` });
const fen = await page.evaluate(async () => {
  const req = indexedDB.open('chess-review-katileasy');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const a = await new Promise((r) => { const q = db.transaction('analyses').objectStore('analyses').get('fixture-0003'); q.onsuccess = () => r(q.result); });
  return a.positions[12].fen;
});
const c = new Chess(fen);
const gameNext = (await page.evaluate(() => null));
const moves = c.moves({ verbose: true });
const m1 = moves[0];
// tap-tap
await page.click(`[data-square="${m1.from}"]`);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/v1-selected.png` });
await page.click(`[data-square="${m1.to}"]`);
await page.waitForSelector('text=Your line');
c.move(m1);
// drag a reply
const m2 = c.moves({ verbose: true })[0];
const a = await page.locator(`[data-square="${m2.from}"]`).boundingBox();
const b = await page.locator(`[data-square="${m2.to}"]`).boundingBox();
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
await page.mouse.down();
await page.mouse.move(a.x + a.width / 2 + 5, a.y + a.height / 2 + 5, { steps: 3 });
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(1500);
console.log('line:', (await page.locator('text=Your line').locator('..').locator('..').innerText()).replace(/\n/g, ' '));
await page.screenshot({ path: `${OUT}/v2-line.png` });
await page.click('[aria-label="Previous move"]');
await page.waitForTimeout(300);
await page.click('text=Back to game');
await page.waitForTimeout(300);
console.log('after back, line visible:', await page.locator('text=Your line').count());
console.log('errors', errors);
await browser.close();
