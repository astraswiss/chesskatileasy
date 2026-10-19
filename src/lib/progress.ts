import type { PatternTag, Phase } from '../types/app';
import { BAD_CLASSES, THRESHOLDS } from '../analysis/build';
import { gameAccuracy } from '../analysis/winprob';
import { TAG_ORDER } from '../components/tags';
import type { Occurrence, Pair } from './coach';
import { parseTimeControl } from './pgn';

/** Aggregate numbers for a set of games, used to compare two periods. */
interface Metrics {
  games: number;
  accuracy: number;
  blunders: number; // per game
  errors: number; // mistakes + misses + blunders per game
  score: number; // 0-1
  tagLoss: Record<PatternTag, number>; // win% lost per game (0-100)
  phase: Record<Phase, number>; // accuracy
  punished: { chances: number; rate: number };
}

const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

function metrics(pairs: Pair[]): Metrics {
  const n = Math.max(1, pairs.length);
  const tagLoss = Object.fromEntries(TAG_ORDER.map((t) => [t, 0])) as Record<PatternTag, number>;
  const phaseAccs: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };
  let blunders = 0;
  let errors = 0;
  let points = 0;
  let chances = 0;
  let punished = 0;
  for (const { game, analysis } of pairs) {
    const c = analysis.counts[analysis.myColor];
    blunders += c.blunder ?? 0;
    errors += (c.blunder ?? 0) + (c.mistake ?? 0) + (c.miss ?? 0);
    points += game.myResult === 'win' ? 1 : game.myResult === 'draw' ? 0.5 : 0;
    analysis.moves.forEach((m, i) => {
      if (m.color !== analysis.myColor) return;
      phaseAccs[m.phase].push(m.accuracy);
      if (BAD_CLASSES.includes(m.classification)) for (const t of m.tags) tagLoss[t] += (m.loss * 100) / n;
      const prev = analysis.moves[i - 1];
      if (prev && prev.loss > THRESHOLDS.mistake) {
        chances++;
        if (m.loss < THRESHOLDS.inaccuracy) punished++;
      }
    });
  }
  return {
    games: pairs.length,
    accuracy: pairs.reduce((s, p) => s + p.analysis.accuracy[p.game.myColor], 0) / n,
    blunders: blunders / n,
    errors: errors / n,
    score: points / n,
    tagLoss,
    phase: Object.fromEntries(PHASES.map((p) => [p, phaseAccs[p].length ? gameAccuracy(phaseAccs[p]) : NaN])) as Record<Phase, number>,
    punished: { chances, rate: chances ? punished / chances : NaN },
  };
}

export interface ProgressItem {
  key: string;
  good: boolean; // improvement (true) or decline (false)
  title: string;
  text: string;
  size: number; // for ranking
}

export interface ProgressReport {
  recent: number;
  previous: number;
  items: ProgressItem[];
}

const TAG_PROGRESS: Record<PatternTag, { better: string; worse: string }> = {
  'hanging-piece': { better: 'You hang fewer pieces', worse: 'You hang more pieces' },
  'missed-tactic': { better: 'You spot more tactics', worse: 'You miss more tactics' },
  'missed-punish': { better: "You punish your opponents' blunders more", worse: "You let more of your opponents' blunders go" },
  'time-trouble': { better: 'Fewer mistakes in time trouble', worse: 'More mistakes in time trouble' },
  'endgame-technique': { better: 'Better at converting won endgames', worse: 'More won endgames slipping away' },
  'opening-prep': { better: 'Fewer opening mistakes', worse: 'More opening mistakes' },
};

const f1 = (x: number) => x.toFixed(1);

/** Compares the latest `range` analyzed games with the `range` games before them. */
export function buildProgress(all: Pair[], range: number): ProgressReport | null {
  // Use the previous block of the same size; with fewer games, split what we have in half.
  const size = Math.min(range, Math.floor(all.length / 2));
  if (size < 5) return null;
  const a = metrics(all.slice(size, size * 2)); // older
  const b = metrics(all.slice(0, size)); // recent
  const items: ProgressItem[] = [];
  const push = (key: string, good: boolean, title: string, text: string, size: number) => items.push({ key, good, title, text, size });

  const dAcc = b.accuracy - a.accuracy;
  if (Math.abs(dAcc) >= 1.5)
    push('accuracy', dAcc > 0, dAcc > 0 ? 'Your accuracy is up' : 'Your accuracy dropped', `Average accuracy went from ${f1(a.accuracy)} to ${f1(b.accuracy)}.`, Math.abs(dAcc) / 2);

  const dBl = b.blunders - a.blunders;
  if (Math.abs(dBl) >= 0.2 && Math.abs(dBl) / Math.max(a.blunders, 0.1) >= 0.15)
    push('blunders', dBl < 0, dBl < 0 ? 'Fewer blunders' : 'More blunders', `${f1(a.blunders)} → ${f1(b.blunders)} blunders per game.`, Math.abs(dBl) * 4);
  else {
    const dErr = b.errors - a.errors;
    if (Math.abs(dErr) >= 0.3 && Math.abs(dErr) / Math.max(a.errors, 0.1) >= 0.15)
      push('errors', dErr < 0, dErr < 0 ? 'Fewer serious mistakes' : 'More serious mistakes', `${f1(a.errors)} → ${f1(b.errors)} mistakes and blunders per game.`, Math.abs(dErr) * 3);
  }

  for (const t of TAG_ORDER) {
    const before = a.tagLoss[t];
    const after = b.tagLoss[t];
    const d = after - before;
    if (Math.max(before, after) < 3 || Math.abs(d) < 2 || Math.abs(d) / Math.max(before, after) < 0.25) continue;
    push(`tag:${t}`, d < 0, d < 0 ? TAG_PROGRESS[t].better : TAG_PROGRESS[t].worse, `Win chance lost to this per game: ${f1(before)}% → ${f1(after)}%.`, Math.abs(d) / 2);
  }

  for (const p of PHASES) {
    const d = b.phase[p] - a.phase[p];
    if (!Number.isFinite(d) || Math.abs(d) < 2) continue;
    push(`phase:${p}`, d > 0, `${p[0].toUpperCase() + p.slice(1)} ${d > 0 ? 'improved' : 'got weaker'}`, `Accuracy in the ${p}: ${f1(a.phase[p])} → ${f1(b.phase[p])}.`, Math.abs(d) / 2);
  }

  if (a.punished.chances >= 3 && b.punished.chances >= 3) {
    const d = b.punished.rate - a.punished.rate;
    if (Math.abs(d) >= 0.1)
      push('punish', d > 0, d > 0 ? 'Punishing blunders more often' : 'Punishing blunders less often', `You punished ${Math.round(a.punished.rate * 100)}% → ${Math.round(b.punished.rate * 100)}% of your opponents' blunders.`, Math.abs(d) * 10);
  }

  const dScore = b.score - a.score;
  if (Math.abs(dScore) >= 0.1)
    push('score', dScore > 0, dScore > 0 ? 'Better results' : 'Worse results', `You scored ${Math.round(a.score * 100)}% → ${Math.round(b.score * 100)}% of the points.`, Math.abs(dScore) * 10);

  // Improvements first, biggest changes first.
  items.sort((x, y) => Number(y.good) - Number(x.good) || y.size - x.size);
  return { recent: size, previous: size, items };
}

export interface Strength {
  key: string;
  title: string;
  text: string;
  link?: string;
}

export function buildStrengths(pairs: Pair[]): { strengths: Strength[]; brilliants: Occurrence[] } {
  const strengths: Strength[] = [];
  if (pairs.length === 0) return { strengths, brilliants: [] };
  const m = metrics(pairs);

  // Strongest phase.
  const phases = PHASES.filter((p) => Number.isFinite(m.phase[p])).sort((x, y) => m.phase[y] - m.phase[x]);
  if (phases.length >= 2 && m.phase[phases[0]] - m.phase[phases[1]] >= 1.5)
    strengths.push({
      key: 'phase',
      title: `Strong ${phases[0]}`,
      text: `Your ${phases[0]} is your best phase: ${f1(m.phase[phases[0]])} accuracy, vs ${f1(m.phase[phases[1]])} in the ${phases[1]}.`,
    });

  // Best openings.
  const openings = new Map<string, { pts: number; n: number }>();
  for (const { game } of pairs) {
    const o = openings.get(game.opening) ?? { pts: 0, n: 0 };
    o.pts += game.myResult === 'win' ? 1 : game.myResult === 'draw' ? 0.5 : 0;
    o.n++;
    openings.set(game.opening, o);
  }
  const best = [...openings.entries()].filter(([, o]) => o.n >= 3 && o.pts / o.n >= 0.55).sort((x, y) => y[1].pts / y[1].n - x[1].pts / x[1].n || y[1].n - x[1].n);
  if (best.length)
    strengths.push({
      key: 'opening',
      title: 'Your best opening' + (best.length > 1 ? 's' : ''),
      text: best
        .slice(0, 2)
        .map(([name, o]) => `${Math.round((o.pts / o.n) * 100)}% score with the ${name} (${o.n} games)`)
        .join(', ') + '.',
    });

  // Brilliant moves.
  const brilliants: Occurrence[] = [];
  for (const { game, analysis } of pairs)
    for (const mv of analysis.moves)
      if (mv.color === analysis.myColor && mv.classification === 'brilliant') brilliants.push({ gameId: game.id, ply: mv.ply, move: mv, game });
  if (brilliants.length)
    strengths.push({
      key: 'brilliant',
      title: brilliants.length === 1 ? 'A brilliant move' : `${brilliants.length} brilliant moves`,
      text: `You found ${brilliants.length === 1 ? 'a sound sacrifice' : `${brilliants.length} sound sacrifices`} that the engine approves of. Tap to replay ${brilliants.length === 1 ? 'it' : 'them'}.`,
      link: '/coach/brilliant',
    });

  // Punishing blunders.
  if (m.punished.chances >= 5 && m.punished.rate >= 0.6)
    strengths.push({
      key: 'punish',
      title: 'You punish blunders',
      text: `When your opponent blunders you take advantage ${Math.round(m.punished.rate * 100)}% of the time (${m.punished.chances} chances).`,
    });

  // Calm under time pressure.
  const acc = { low: [] as number[], high: [] as number[] };
  for (const { game, analysis } of pairs) {
    const tc = parseTimeControl(game.timeControl);
    if (tc.daily || !tc.base) continue;
    for (const mv of analysis.moves) {
      if (mv.color !== analysis.myColor || mv.clock === undefined) continue;
      const frac = (mv.clock + (mv.timeSpent ?? 0) - tc.inc) / tc.base;
      if (frac < 0.1) acc.low.push(mv.accuracy);
      else if (frac > 0.5) acc.high.push(mv.accuracy);
    }
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  if (acc.low.length >= 20 && acc.high.length >= 20 && avg(acc.low) >= avg(acc.high) - 1)
    strengths.push({
      key: 'clock',
      title: 'Cool under pressure',
      text: `Your moves with under 10% of the clock left are as accurate as the rest (${f1(avg(acc.low))} vs ${f1(avg(acc.high))}).`,
    });

  // Best game.
  const top = [...pairs].sort((x, y) => y.analysis.accuracy[y.game.myColor] - x.analysis.accuracy[x.game.myColor])[0];
  strengths.push({
    key: 'best-game',
    title: 'Your best game',
    text: `${f1(top.analysis.accuracy[top.game.myColor])} accuracy vs ${top.game.oppName} (${top.game.myResult === 'win' ? 'won' : top.game.myResult === 'draw' ? 'drawn' : 'lost'}). Tap to replay it.`,
    link: `/game/${top.game.id}`,
  });

  return { strengths, brilliants };
}
