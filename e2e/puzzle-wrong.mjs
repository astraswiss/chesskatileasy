import { launch } from './mock.mjs';
import { Chess } from 'chess.js';
const OUT = process.argv[3] ?? '.';
const { browser, page, errors } = await launch({ profile: process.argv[2] });
await page.goto('http://localhost:5173/#/puzzles');
await page.waitForSelector('text=Find the best move', { timeout: 20000 });
const ps = await page.evaluate(async () => {
  const req = indexedDB.open('chess-review-tuo_username');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  return await new Promise((r) => { const q = db.transaction('puzzles').objectStore('puzzles').getAll(); q.onsuccess = () => r(q.result); });
});
const now = Date.now();
const due = ps.filter((p) => p.status === 'new' || (p.status === 'failed' && p.due <= now))
  .sort((a, b) => (a.status === 'failed' ? 0 : 1) - (b.status === 'failed' ? 0 : 1) || b.endTime - a.endTime || a.ply - b.ply);
const p = due[0];
const c = new Chess(p.fen);
// a legal move that is clearly not the best: pick the last legal non-best move
const mv = c.moves({ verbose: true }).filter((m) => m.lan !== p.bestUci).pop();
console.log('puzzle', p.id, 'best', p.bestSan, 'trying', mv.san);
await page.click(`[data-square="${mv.from}"]`).catch(async () => {
  console.log('no data-square attr; trying id');
});
await page.click(`[data-square="${mv.to}"]`);
await page.waitForSelector('text=/Correct|isn’t it/', { timeout: 30000 });
console.log('verdict:', (await page.locator('text=/Correct|isn’t it/').first().innerText()).slice(0, 80));
await page.screenshot({ path: `${OUT}/p7-wrong.png` });
console.log('errors', errors);
await browser.close();
