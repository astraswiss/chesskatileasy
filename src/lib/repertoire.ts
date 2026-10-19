import { Chess } from 'chess.js';
import { REPERTOIRE, type RepertoireDef } from '../config';
import type { Game, GameAnalysis, MoveAnalysis } from '../types/app';
import { BAD_CLASSES } from '../analysis/build';
import { gameAccuracy, scoreToCp, winPercent } from '../analysis/winprob';
import { uciToSan } from '../analysis/material';
import { parseGame } from './pgn';

export { REPERTOIRE, type RepertoireDef };

/** Ply at which we judge "how the opening went" (after move 10). */
export const OPENING_CHECK_PLY = 20;

// ---- SAN move lists (cached; parsing PGNs is the expensive part) ----
const sanCache = new Map<string, string[]>();
export function sanMoves(game: Game): string[] {
  let s = sanCache.get(game.id);
  if (!s) {
    try {
      s = parseGame(game.pgn).moves.map((m) => m.san);
    } catch {
      s = [];
    }
    sanCache.set(game.id, s);
  }
  return s;
}

const startsWith = (moves: string[], prefix: string[]) => prefix.every((m, i) => moves[i] === m);

export function repertoireOf(game: Game): RepertoireDef | undefined {
  const sans = sanMoves(game);
  return REPERTOIRE.find((r) => r.color === game.myColor && startsWith(sans, r.root));
}

export function lineOf(def: RepertoireDef, game: Game): string {
  const rest = sanMoves(game).slice(def.root.length);
  let best = { name: 'Other', len: -1 };
  for (const l of def.lines) if (l.moves.length > best.len && startsWith(rest, l.moves)) best = { name: l.name, len: l.moves.length };
  return best.name;
}

/** My win% (0-100) at position index k of an analyzed game. */
export function myWinAt(a: GameAnalysis, k: number): number | undefined {
  const p = a.positions[k];
  if (!p) return undefined;
  const w = winPercent(scoreToCp(p.score));
  const meToMove = (k % 2 === 0) === (a.myColor === 'white');
  return meToMove ? w : 100 - w;
}

const points = (g: Game) => (g.myResult === 'win' ? 1 : g.myResult === 'draw' ? 0.5 : 0);

export interface RepGame {
  game: Game;
  analysis?: GameAnalysis;
  line: string;
}

export interface LineRow {
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  analyzed: number;
  openingAccuracy?: number;
  winAt10?: number; // my average win% after move 10
}

export interface OpeningMistake {
  game: Game;
  move: MoveAnalysis;
  line: string;
}

export interface RepertoireReport {
  def: RepertoireDef;
  games: RepGame[];
  total: LineRow;
  lines: LineRow[];
  mistakes: OpeningMistake[];
}

function summarize(name: string, gs: RepGame[]): LineRow {
  const wins = gs.filter((g) => g.game.myResult === 'win').length;
  const draws = gs.filter((g) => g.game.myResult === 'draw').length;
  const analyzed = gs.filter((g) => g.analysis);
  const accs = analyzed.flatMap((g) => g.analysis!.moves.filter((m) => m.color === g.game.myColor && m.phase === 'opening').map((m) => m.accuracy));
  const wins10 = analyzed.map((g) => myWinAt(g.analysis!, Math.min(OPENING_CHECK_PLY, g.analysis!.positions.length - 1))).filter((x): x is number => x !== undefined);
  return {
    name,
    games: gs.length,
    wins,
    draws,
    losses: gs.length - wins - draws,
    score: gs.length ? gs.reduce((s, g) => s + points(g.game), 0) / gs.length : 0,
    analyzed: analyzed.length,
    openingAccuracy: accs.length ? gameAccuracy(accs) : undefined,
    winAt10: wins10.length ? wins10.reduce((a, b) => a + b, 0) / wins10.length : undefined,
  };
}

export function buildRepertoireReport(def: RepertoireDef, games: Game[], analyses: Map<string, GameAnalysis>): RepertoireReport {
  const rg: RepGame[] = games.filter((g) => repertoireOf(g)?.id === def.id).map((g) => ({ game: g, analysis: analyses.get(g.id), line: lineOf(def, g) }));
  const byLine = new Map<string, RepGame[]>();
  for (const g of rg) byLine.set(g.line, [...(byLine.get(g.line) ?? []), g]);
  const lines = [...byLine.entries()].map(([name, gs]) => summarize(name, gs)).sort((a, b) => b.games - a.games);
  const mistakes: OpeningMistake[] = rg
    .flatMap((g) =>
      g.analysis
        ? g.analysis.moves
            .filter((m) => m.color === g.game.myColor && m.phase === 'opening' && BAD_CLASSES.includes(m.classification))
            .map((m) => ({ game: g.game, move: m, line: g.line }))
        : [],
    )
    .sort((a, b) => b.game.endTime - a.game.endTime || a.move.ply - b.move.ply);
  return { def, games: rg, total: summarize(def.name, rg), lines, mistakes };
}

// ---- explorer: what was played from a position, in my games ----

export interface ExplorerMove {
  san: string;
  count: number;
  score: number; // my score in games that went this way
  mine: boolean; // it's my move here
  avgLoss?: number; // average win% lost when I played it (my moves only)
}

export interface ExplorerNode {
  fen: string;
  path: string[];
  games: number;
  moves: ExplorerMove[];
  myTurn: boolean;
  engineBest?: string; // SAN
  myWin?: number;
}

export function explore(rg: RepGame[], path: string[]): ExplorerNode {
  const c = new Chess();
  for (const san of path) {
    try {
      c.move(san);
    } catch {
      break;
    }
  }
  const at = rg.filter((g) => startsWith(sanMoves(g.game), path));
  const k = path.length;
  const myTurn = rg[0] ? (k % 2 === 0) === (rg[0].game.myColor === 'white') : false;
  const children = new Map<string, { count: number; pts: number; losses: number[] }>();
  let engineBestUci: string | undefined;
  const wins: number[] = [];
  for (const g of at) {
    const san = sanMoves(g.game)[k];
    const a = g.analysis;
    if (a) {
      engineBestUci ??= a.positions[k]?.best;
      const w = myWinAt(a, k);
      if (w !== undefined) wins.push(w);
    }
    if (!san) continue;
    const e = children.get(san) ?? { count: 0, pts: 0, losses: [] };
    e.count++;
    e.pts += points(g.game);
    if (a?.moves[k] && myTurn) e.losses.push(a.moves[k].loss);
    children.set(san, e);
  }
  const moves = [...children.entries()]
    .map(([san, e]) => ({
      san,
      count: e.count,
      score: e.pts / e.count,
      mine: myTurn,
      avgLoss: e.losses.length ? (e.losses.reduce((s, x) => s + x, 0) / e.losses.length) * 100 : undefined,
    }))
    .sort((a, b) => b.count - a.count);
  return {
    fen: c.fen(),
    path,
    games: at.length,
    moves,
    myTurn,
    engineBest: engineBestUci ? uciToSan(c.fen(), engineBestUci) : undefined,
    myWin: wins.length ? wins.reduce((s, x) => s + x, 0) / wins.length : undefined,
  };
}
