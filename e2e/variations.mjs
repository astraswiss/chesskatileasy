// Per-variation trainer: learn the Slav main line, repeat it correctly, check 100% mastery; random mode.
import { launch } from './mock.mjs';
import { Chess } from 'chess.js';
const OUT = process.argv[3] ?? '.';
const { browser, page, errors } = await launch({ profile: process.argv[2] });
page.setDefaultTimeout(120000);
const card = () => page.locator('main .rounded-2xl').last();
const currentPath = async () => (await page.locator('main .no-scrollbar span.shrink-0').allInnerTexts()).map((t) => t.replace(/^\d+\./, ''));
const play = async (san) => {
  const c = new Chess();
  for (const m of await currentPath()) c.move(m);
  const mv = c.move(san);
  await page.click(`[data-square="${mv.from}"]`);
  await page.click(`[data-square="${mv.to}"]`);
};
const answers = new Map();
// Answer of a position learned in an earlier session (cards are shared across variations).
const storedAnswer = (key) => page.evaluate(async (key) => {
  const req = indexedDB.open('chess-review-katileasy');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const all = await new Promise((r) => { const q = db.transaction('drill').objectStore('drill').getAll(); q.onsuccess = () => r(q.result); });
  return all.find((c) => c.path.join(' ') === key)?.answer;
}, key);
async function runLine(label) {
  const seen = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForSelector('text=/Play [A-Za-z]|Your move: what|Line complete/');
    const txt = await card().innerText();
    if (/Line complete/.test(txt)) break;
    const key = (await currentPath()).join(' ');
    const m = /Play\s+(\S+)/.exec(txt);
    const san = m ? m[1] : answers.get(key) ?? (await storedAnswer(key));
    if (!san) { console.log(label, 'no answer known for', key); return seen; }
    answers.set(key, san);
    seen.push((m ? 'learn ' : 'quiz ') + san);
    await play(san);
  }
  return seen;
}
await page.goto('http://localhost:5173/#/openings/queens-gambit/trainer');
await page.waitForSelector('text=/variations known 100%/');
await page.click('button:has-text("8")');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/h1-hub.png` });
await page.click('button:has-text("Slav Defense")');
console.log('round 1:', (await runLine('r1')).join(', '));
await page.click('text=Again');
console.log('round 2:', (await runLine('r2')).join(', '));
console.log('done text:', (await card().innerText()).split('\n').slice(0, 2).join(' | '));
await page.click('button:has-text("Done")');
await page.waitForSelector('text=/variations known 100%/');
await page.waitForTimeout(800);
console.log('hub summary:', (await page.locator('main .rounded-2xl').first().innerText()).split('\n').slice(0, 4).join(' | '));
console.log('Slav row:', (await page.locator('button:has-text("Slav Defense")').first().innerText()).replace(/\n/g, ' | '));
await page.screenshot({ path: `${OUT}/h2-hub-after.png`, fullPage: true });
await page.click('text=Random variation');
await page.waitForSelector('text=/Play [A-Za-z]|Your move: what/');
console.log('random title:', await page.locator('header h1').innerText());
console.log('errors', errors);
await browser.close();
