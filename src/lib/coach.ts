import type { Game, GameAnalysis, MoveAnalysis, PatternTag, Phase } from '../types/app';
import { gameAccuracy } from '../analysis/winprob';
import { BAD_CLASSES } from '../analysis/build';
import { parseTimeControl } from './pgn';
import { TAG_META, TAG_ORDER } from '../components/tags';

export interface Occurrence {
  gameId: string;
  ply: number;
  move: MoveAnalysis;
  game: Game;
}

export interface Weakness {
  tag: PatternTag;
  totalLoss: number; // sum of win% lost (0-1 units, can exceed 1)
  count: number;
  games: number;
  occurrences: Occurrence[];
  title: string;
  text: string;
}

export interface OpeningRow {
  name: string;
  games: number;
  score: number; // 0-1
  accuracy: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface CoachReport {
  n: number;
  weaknesses: Weakness[];
  allWeaknesses: Weakness[];
  phaseAccuracy: { phase: Phase; accuracy: number; moves: number; lost: number }[];
  worstOpenings: OpeningRow[];
  clockBuckets: { label: string; accuracy: number; moves: number; mistakes: number }[];
  lostOnTime: number;
  timeTroubleGames: number;
  trend: { idx: number; date: number; accuracy: number; blunders: number; accAvg: number; blunderAvg: number }[];
}

export type Pair = { game: Game; analysis: GameAnalysis };

function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

function weaknessText(tag: PatternTag, w: Omit<Weakness, 'title' | 'text'>, n: number, top: boolean, extra: { worstOpening?: string }): { title: string; text: string } {
  const pts = Math.round((w.totalLoss * 100) / Math.max(1, w.games));
  const lead = (area: string) => (top ? `Most of your lost points come from ${area}: ` : '');
  const g = `${w.games} of the last ${n} games`;
  switch (tag) {
    case 'endgame-technique':
      return {
        title: 'Converting endgames',
        text: `${lead('endgames')}you threw away a winning position in ${g}. Slow down once you're ahead in the endgame and look for the simplest win.`,
      };
    case 'hanging-piece':
      return {
        title: 'Hanging pieces',
        text: `${lead('loose pieces')}you left a piece en prise ${plural(w.count, 'time')} in ${g} (about −${pts}% win chance each time it happened). Before every move, check what your opponent can capture.`,
      };
    case 'missed-tactic':
      return {
        title: 'Missed tactics',
        text: `${lead('missed tactics')}a move winning material or mating was available ${plural(w.count, 'time')} in ${g}. Scan checks, captures and threats before settling on a move.`,
      };
    case 'missed-punish':
      return {
        title: 'Punishing mistakes',
        text: `${lead("opponents' mistakes you didn't punish")}your opponent blundered and you let them off the hook ${plural(w.count, 'time')} in ${g}. When they play something surprising, ask what it allows.`,
      };
    case 'time-trouble':
      return {
        title: 'Time management',
        text: `${lead('time trouble')}${plural(w.count, 'mistake')} in ${g} came with under 10% of your clock left or after a move played in under 2 seconds. Spend time early on critical positions.`,
      };
    case 'opening-prep':
      return {
        title: 'Opening preparation',
        text: `${lead('the opening')}you made ${plural(w.count, 'mistake')} before move 12 in ${g}${extra.worstOpening ? `, most painfully in the ${extra.worstOpening}` : ''}. Review the first moves of these games.`,
      };
  }
}

const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

export function buildCoachReport(pairs: Pair[]): CoachReport {
  const n = pairs.length;
  // ---- weaknesses ----
  const byTag = new Map<PatternTag, { totalLoss: number; count: number; games: Set<string>; occ: Occurrence[] }>();
  const openingLoss = new Map<string, number>();
  for (const { game, analysis } of pairs) {
    for (const m of analysis.moves) {
      if (m.color !== analysis.myColor || !BAD_CLASSES.includes(m.classification)) continue;
      for (const t of m.tags) {
        const e = byTag.get(t) ?? { totalLoss: 0, count: 0, games: new Set(), occ: [] };
        e.totalLoss += m.loss;
        e.count++;
        e.games.add(game.id);
        e.occ.push({ gameId: game.id, ply: m.ply, move: m, game });
        byTag.set(t, e);
        if (t === 'opening-prep') openingLoss.set(game.opening, (openingLoss.get(game.opening) ?? 0) + m.loss);
      }
    }
  }
  const worstOpening = [...openingLoss.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ranked = TAG_ORDER.filter((t) => byTag.has(t))
    .map((t) => ({ tag: t, ...byTag.get(t)! }))
    .sort((a, b) => b.totalLoss - a.totalLoss);
  const allWeaknesses: Weakness[] = ranked.map((r, i) => {
    const base = {
      tag: r.tag,
      totalLoss: r.totalLoss,
      count: r.count,
      games: r.games.size,
      occurrences: r.occ.sort((a, b) => b.game.endTime - a.game.endTime || b.move.loss - a.move.loss),
    };
    const t = weaknessText(r.tag, base, n, i === 0, { worstOpening });
    return { ...base, title: t.title, text: t.text.charAt(0).toUpperCase() + t.text.slice(1) };
  });

  // ---- phases ----
  const phaseAccuracy = PHASES.map((phase) => {
    const ms = pairs.flatMap(({ analysis }) => analysis.moves.filter((m) => m.color === analysis.myColor && m.phase === phase));
    return { phase, accuracy: gameAccuracy(ms.map((m) => m.accuracy)), moves: ms.length, lost: ms.reduce((a, m) => a + m.loss, 0) };
  });

  // ---- openings ----
  const openings = new Map<string, { w: number; d: number; l: number; acc: number[] }>();
  for (const { game, analysis } of pairs) {
    const o = openings.get(game.opening) ?? { w: 0, d: 0, l: 0, acc: [] };
    if (game.myResult === 'win') o.w++;
    else if (game.myResult === 'draw') o.d++;
    else o.l++;
    o.acc.push(analysis.accuracy[game.myColor]);
    openings.set(game.opening, o);
  }
  const worstOpenings: OpeningRow[] = [...openings.entries()]
    .map(([name, o]) => {
      const games = o.w + o.d + o.l;
      return { name, games, wins: o.w, draws: o.d, losses: o.l, score: (o.w + o.d / 2) / games, accuracy: o.acc.reduce((a, b) => a + b, 0) / o.acc.length };
    })
    .filter((o) => o.games >= 3)
    .sort((a, b) => a.score - b.score || a.accuracy - b.accuracy)
    .slice(0, 5);

  // ---- clock ----
  const buckets = [
    { label: '> 50% clock', min: 0.5, max: Infinity },
    { label: '25–50%', min: 0.25, max: 0.5 },
    { label: '10–25%', min: 0.1, max: 0.25 },
    { label: '< 10%', min: -Infinity, max: 0.1 },
  ].map((b) => ({ ...b, accs: [] as number[], mistakes: 0 }));
  let timeTroubleGames = 0;
  for (const { game, analysis } of pairs) {
    const tc = parseTimeControl(game.timeControl);
    if (tc.daily || !tc.base) continue;
    let inTrouble = false;
    for (const m of analysis.moves) {
      if (m.color !== analysis.myColor || m.clock === undefined) continue;
      // Clock before the move = clock after + time spent - increment.
      const before = m.clock + (m.timeSpent ?? 0) - tc.inc;
      const frac = before / tc.base;
      if (frac < 0.1) inTrouble = true;
      const b = buckets.find((x) => frac >= x.min && frac < x.max);
      if (!b) continue;
      b.accs.push(m.accuracy);
      if (m.loss > 0.1) b.mistakes++;
    }
    if (inTrouble) timeTroubleGames++;
  }
  const clockBuckets = buckets.map((b) => ({
    label: b.label,
    accuracy: b.accs.length ? b.accs.reduce((a, c) => a + c, 0) / b.accs.length : 0,
    moves: b.accs.length,
    mistakes: b.mistakes,
  }));
  const lostOnTime = pairs.filter(({ game }) => game.myResult === 'loss' && game.myResultDetail === 'timeout').length;

  // ---- trend (oldest → newest, rolling average) ----
  const chrono = [...pairs].sort((a, b) => a.game.endTime - b.game.endTime);
  const win = Math.max(3, Math.round(n / 10));
  const trend = chrono.map(({ game, analysis }, i) => {
    const slice = chrono.slice(Math.max(0, i - win + 1), i + 1);
    const blunders = (a: GameAnalysis) => a.counts[a.myColor].blunder ?? 0;
    return {
      idx: i + 1,
      date: game.endTime,
      accuracy: analysis.accuracy[game.myColor],
      blunders: blunders(analysis),
      accAvg: slice.reduce((s, p) => s + p.analysis.accuracy[p.game.myColor], 0) / slice.length,
      blunderAvg: slice.reduce((s, p) => s + blunders(p.analysis), 0) / slice.length,
    };
  });

  return { n, weaknesses: allWeaknesses.slice(0, 3), allWeaknesses, phaseAccuracy, worstOpenings, clockBuckets, lostOnTime, timeTroubleGames, trend };
}

export { TAG_META };
