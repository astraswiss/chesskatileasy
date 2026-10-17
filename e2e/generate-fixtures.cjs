// Generates fake chess.com API responses (games played by Stockfish at low skill)
// so the app can be exercised without network access. Usage: node e2e/generate-fixtures.cjs [count]
const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const USER = 'TUO_USERNAME';
const COUNT = Number(process.argv[2] || 24);
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

const openings = [
  ['e4 e5 Nf3 Nc6 Bb5', 'Ruy-Lopez-Opening', 'C60'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian-Defense-Najdorf-Variation', 'B90'],
  ['d4 d5 c4 e6 Nc3 Nf6', 'Queens-Gambit-Declined-Normal-Defense', 'D37'],
  ['e4 e6 d4 d5', 'French-Defense-Normal-Variation', 'C00'],
  ['e4 d5 exd5 Qxd5 Nc3 Qa5', 'Scandinavian-Defense-Mieses-Kotroc-Variation-3.Nc3-Qa5', 'B01'],
  ['d4 Nf6 c4 g6 Nc3 Bg7 e4 d6', 'Kings-Indian-Defense-Normal-Variation', 'E70'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'Italian-Game-Giuoco-Piano', 'C50'],
  ['c4 e5', 'English-Opening-Kings-English-Variation', 'A20'],
];
const opponents = ['magnus_fan', 'pawnstorm77', 'knightrider', 'endgame_ella', 'blitzbaron', 'rookie_rook', 'zugzwangzed'];
const tcs = [['180+2', 'blitz', 180, 2], ['60', 'bullet', 60, 0], ['600', 'rapid', 600, 0], ['300', 'blitz', 300, 0]];

let engine;
let pending = null;
function send(cmd) { engine.processCommand(cmd); }
function search(fen, skill, depth) {
  return new Promise((resolve) => {
    let score = 0;
    pending = (line) => {
      const m = / score (cp|mate) (-?\d+)/.exec(line);
      if (m) score = m[1] === 'cp' ? Number(m[2]) : (Number(m[2]) > 0 ? 10000 : -10000);
      if (line.startsWith('bestmove')) { pending = null; resolve({ move: line.split(' ')[1], score }); }
    };
    send(`setoption name Skill Level value ${skill}`);
    send(`position fen ${fen}`);
    send(`go depth ${depth}`);
  });
}

function clk(s) {
  s = Math.max(0, s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(1);
  return `${h}:${String(m).padStart(2, '0')}:${sec.padStart(4, '0')}`;
}

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

async function playGame(i) {
  const [line, ecoSlug, eco] = openings[i % openings.length];
  const [tc, timeClass, base, inc] = tcs[i % tcs.length];
  const meWhite = i % 2 === 0;
  const mySkill = 3 + Math.floor(rnd() * 6);
  const oppSkill = 3 + Math.floor(rnd() * 6);
  const chess = new Chess();
  for (const san of line.split(' ')) chess.move(san);
  const clocks = [base, base];
  const moveClocks = chess.history().map((_, k) => { clocks[k % 2] -= 1 + rnd() * 2; clocks[k % 2] += inc; return clocks[k % 2]; });
  let result = null; // {winner: 'white'|'black'|null, how}
  let losingStreak = 0;
  while (!chess.isGameOver() && chess.history().length < 160) {
    const turn = chess.turn() === 'w' ? 0 : 1;
    const isMe = (turn === 0) === meWhite;
    const { move, score } = await search(chess.fen(), isMe ? mySkill : oppSkill, 6);
    if (!move || move === '(none)') break;
    chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
    const spent = Math.min(clocks[turn] * 0.15, 0.5 + rnd() * (base / 40));
    clocks[turn] = clocks[turn] - spent + inc;
    if (clocks[turn] <= 0) { clocks[turn] = 0; moveClocks.push(0); result = { winner: turn === 0 ? 'black' : 'white', how: 'timeout' }; break; }
    moveClocks.push(clocks[turn]);
    // score is from the perspective of the side that just moved (search was from its pov)
    if (score < -700) losingStreak++; else losingStreak = 0;
    if (losingStreak >= 2 && rnd() < 0.6) { result = { winner: turn === 0 ? 'black' : 'white', how: 'resigned' }; break; }
  }
  if (!result) {
    if (chess.isCheckmate()) result = { winner: chess.turn() === 'w' ? 'black' : 'white', how: 'checkmated' };
    else if (chess.isStalemate()) result = { winner: null, how: 'stalemate' };
    else if (chess.isThreefoldRepetition()) result = { winner: null, how: 'repetition' };
    else if (chess.isInsufficientMaterial()) result = { winner: null, how: 'insufficient' };
    else result = { winner: null, how: 'agreed' };
  }
  const opp = opponents[i % opponents.length];
  const myRating = 1200 + Math.round(rnd() * 150) + i * 3;
  const oppRating = myRating + Math.round((rnd() - 0.5) * 200);
  const white = meWhite ? USER : opp, black = meWhite ? opp : USER;
  const wRes = result.winner === 'white' ? 'win' : result.winner === 'black' ? result.how : result.how;
  const bRes = result.winner === 'black' ? 'win' : result.winner === 'white' ? result.how : result.how;
  const resStr = result.winner === 'white' ? '1-0' : result.winner === 'black' ? '0-1' : '1/2-1/2';
  const end = Date.UTC(2026, 9, 16, 20, 0, 0) / 1000 - i * 86400 * 2.3;
  const d = new Date(end * 1000);
  const date = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
  const hist = chess.history();
  let moveText = '';
  hist.forEach((san, k) => {
    const n = Math.floor(k / 2) + 1;
    moveText += (k % 2 === 0 ? `${n}. ` : `${n}... `) + `${san} {[%clk ${clk(moveClocks[k])}]} `;
  });
  const termination = result.winner ? `${result.winner === 'white' ? white : black} won by ${result.how === 'checkmated' ? 'checkmate' : result.how === 'timeout' ? 'time' : 'resignation'}` : 'Game drawn';
  const pgn = [
    `[Event "Live Chess"]`, `[Site "Chess.com"]`, `[Date "${date}"]`, `[Round "-"]`,
    `[White "${white}"]`, `[Black "${black}"]`, `[Result "${resStr}"]`, `[CurrentPosition "${chess.fen()}"]`,
    `[Timezone "UTC"]`, `[ECO "${eco}"]`, `[ECOUrl "https://www.chess.com/openings/${ecoSlug}"]`,
    `[UTCDate "${date}"]`, `[UTCTime "19:30:00"]`, `[WhiteElo "${meWhite ? myRating : oppRating}"]`, `[BlackElo "${meWhite ? oppRating : myRating}"]`,
    `[TimeControl "${tc}"]`, `[Termination "${termination}"]`, `[StartTime "19:30:00"]`, `[EndDate "${date}"]`, `[EndTime "20:00:00"]`,
    `[Link "https://www.chess.com/game/live/${100000 + i}"]`, '', moveText + resStr, '',
  ].join('\n');
  return {
    url: `https://www.chess.com/game/live/${100000 + i}`, pgn, time_control: tc, end_time: Math.round(end), rated: true,
    tcn: '', uuid: `fixture-${String(i).padStart(4, '0')}`, initial_setup: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fen: chess.fen(), time_class: timeClass, rules: 'chess',
    white: { rating: meWhite ? myRating : oppRating, result: wRes, '@id': `https://api.chess.com/pub/player/${white.toLowerCase()}`, username: white },
    black: { rating: meWhite ? oppRating : myRating, result: bRes, '@id': `https://api.chess.com/pub/player/${black.toLowerCase()}`, username: black },
    eco: `https://www.chess.com/openings/${ecoSlug}`,
  };
}

(async () => {
  engine = require('stockfish')('lite-single', (l) => pending && pending(l));
  await new Promise((r) => setTimeout(r, 300));
  send('uci');
  const byMonth = {};
  for (let i = 0; i < COUNT; i++) {
    const g = await playGame(i);
    const d = new Date(g.end_time * 1000);
    const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    (byMonth[key] ||= []).push(g);
    process.stdout.write(`game ${i} ${g.white.result}/${g.black.result} ${g.pgn.split('\n').pop() || ''}\n`);
  }
  const months = Object.keys(byMonth).sort();
  const base = `https://api.chess.com/pub/player/${USER.toLowerCase()}/games`;
  fs.writeFileSync(path.join(OUT, 'archives.json'), JSON.stringify({ archives: months.map((m) => `${base}/${m}`) }));
  for (const m of months) {
    const games = byMonth[m].sort((a, b) => a.end_time - b.end_time);
    fs.writeFileSync(path.join(OUT, `${m.replace('/', '-')}.json`), JSON.stringify({ games }));
  }
  console.log('months', months);
  process.exit(0);
})();
