// Wrong move → "try again" → correct move; the puzzle is still scheduled for review.
import { launch } from './mock.mjs';
import { Chess } from 'chess.js';
const OUT = process.argv[3] ?? '.';
const { browser, page, errors } = await launch({ profile: process.argv[2] });
await page.goto('http://localhost:5173/#/puzzles');
await page.waitForSelector('text=Find the best move', { timeout: 20000 });
const readPuzzles = () => page.evaluate(async () => {
  const req = indexedDB.open('chess-review-katileasy');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  return await new Promise((r) => { const q = db.transaction('puzzles').objectStore('puzzles').getAll(); q.onsuccess = () => r(q.result); });
});
const ps = await readPuzzles();
const now = Date.now();
const due = ps.filter((p) => p.status === 'new' || (p.status === 'failed' && p.due <= now))
  .sort((a, b) => (a.status === 'failed' ? 0 : 1) - (b.status === 'failed' ? 0 : 1) || b.endTime - a.endTime || a.ply - b.ply);
const p = due[0];
const c = new Chess(p.fen);
const wrong = c.moves({ verbose: true }).filter((m) => m.lan !== p.bestUci).pop();
const tap = async (a, b) => { await page.click(`[data-square="${a}"]`); await page.click(`[data-square="${b}"]`); };
console.log('puzzle', p.id, 'best', p.bestSan, 'wrong try', wrong.san);
await tap(wrong.from, wrong.to);
await page.waitForSelector('text=/Try again/', { timeout: 30000 });
await page.waitForTimeout(900); // board resets
await page.screenshot({ path: `${OUT}/p7-tryagain.png` });
await tap(p.bestUci.slice(0, 2), p.bestUci.slice(2, 4));
await page.waitForSelector('text=/Correct/', { timeout: 30000 });
console.log('verdict:', (await page.locator('text=/Correct/').first().innerText()).replace(/\n/g, ' '));
await page.screenshot({ path: `${OUT}/p7-correct.png` });
// keep playing after solving: a reply for the other side, then reset
c.move({ from: p.bestUci.slice(0, 2), to: p.bestUci.slice(2, 4), promotion: p.bestUci[4] });
const reply = c.moves({ verbose: true })[0];
await tap(reply.from, reply.to);
await page.waitForTimeout(400);
const pieceAt = (sq) => page.locator(`[data-square="${sq}"] [data-piece]`).count();
console.log('explore move', reply.san, 'piece on target:', await pieceAt(reply.to));
await page.screenshot({ path: `${OUT}/p7-explore.png` });
await page.click('text=Reset position');
await page.waitForTimeout(400);
console.log('after reset, piece back on', reply.from, ':', await pieceAt(reply.from), '| reset button gone:', (await page.locator('text=Reset position').count()) === 0);
const after = (await readPuzzles()).find((x) => x.id === p.id);
console.log('stored:', after.status, 'attempts', after.attempts, 'due in days', ((after.due - Date.now()) / 864e5).toFixed(2));
console.log('errors', errors);
await browser.close();
