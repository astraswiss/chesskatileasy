// Opening trainer: learn a line, then get quizzed on it; a wrong answer is caught.
import { launch } from './mock.mjs';
import { Chess } from 'chess.js';
const OUT = process.argv[3] ?? '.';
const { browser, page, errors } = await launch({ profile: process.argv[2] });
page.setDefaultTimeout(90000);
await page.goto('http://localhost:5173/#/openings/queens-gambit/train');
const currentPath = async () => {
  const chips = await page.locator('main .no-scrollbar span.shrink-0').allInnerTexts();
  return chips.map((t) => t.replace(/^\d+\./, ''));
};
const play = async (san) => {
  const c = new Chess();
  for (const m of await currentPath()) c.move(m);
  const mv = c.move(san);
  await page.click(`[data-square="${mv.from}"]`);
  await page.click(`[data-square="${mv.to}"]`);
};
const waitTurn = () => page.waitForSelector('text=/Play [A-Za-z]|Your move: what|Line complete/');
let learned = 0, t0 = Date.now();
for (let i = 0; i < 4; i++) {
  await waitTurn();
  const txt = await page.locator('main .rounded-2xl').last().innerText();
  if (/Line complete/.test(txt)) break;
  const m = /Play\s+(\S+)/.exec(txt);
  if (!m) { console.log('unexpected', txt); break; }
  if (i === 0) await page.screenshot({ path: `${OUT}/t1-learn.png` });
  await play(m[1]);
  learned++;
  console.log('learned', m[1], 'path now', (await currentPath()).join(' '));
}
console.log('learn phase took', Math.round((Date.now() - t0) / 1000), 's');
// new line: first position after the opponent reply may repeat → quiz
for (let attempt = 0; attempt < 6; attempt++) {
  await page.click('text=New line');
  await waitTurn();
  const txt = await page.locator('main .rounded-2xl').last().innerText();
  if (/Your move: what/.test(txt)) {
    await page.screenshot({ path: `${OUT}/t2-quiz.png` });
    // play a wrong (but legal) move
    const c = new Chess();
    for (const mm of await currentPath()) c.move(mm);
    const wrong = c.moves({ verbose: true }).find((x) => x.piece === 'p' && ['a', 'h'].includes(x.from[0]));
    await page.click(`[data-square="${wrong.from}"]`);
    await page.click(`[data-square="${wrong.to}"]`);
    await page.waitForSelector('text=/isn’t the move|is also good/');
    console.log('after wrong move:', (await page.locator('main .rounded-2xl').last().innerText()).split('\n').slice(0, 2).join(' | '));
    await page.screenshot({ path: `${OUT}/t3-wrong.png` });
    break;
  }
  console.log('attempt', attempt, 'got a new position instead of quiz');
}
const cards = await page.evaluate(async () => {
  const req = indexedDB.open('chess-review-katileasy');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  return await new Promise((r) => { const q = db.transaction('drill').objectStore('drill').getAll(); q.onsuccess = () => r(q.result.map((c) => `${c.path.join(' ')} → ${c.answer} (stage ${c.stage}, wrong ${c.wrong})`)); });
});
console.log('cards:\n ' + cards.join('\n '));
console.log('errors', errors);
await browser.close();
