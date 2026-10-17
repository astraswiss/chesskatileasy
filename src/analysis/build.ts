import { Chess, type Square } from 'chess.js';
import type {
  ClassCounts,
  Classification,
  Color,
  Game,
  GameAnalysis,
  MoveAnalysis,
  PatternTag,
  PositionEval,
} from '../types/app';
import { parseEcoUrl, parseGame, parseTimeControl, type ParsedGame } from '../lib/pgn';
import { balance, PIECE_VALUE, playLine, uciToSan } from './material';
import { gamePhases } from './phase';
import { gameAccuracy, moveAccuracy, scoreToCp, winPercent } from './winprob';

/** Bump when classification logic changes: stored analyses are rebuilt from raw evals. */
export const ANALYSIS_VERSION = 3;

const BOOK_MAX_PLIES = 10;

export const THRESHOLDS = { excellent: 0.02, good: 0.05, inaccuracy: 0.1, mistake: 0.2 } as const;

function baseClass(loss: number): Classification {
  if (loss <= THRESHOLDS.excellent) return 'excellent';
  if (loss <= THRESHOLDS.good) return 'good';
  if (loss <= THRESHOLDS.inaccuracy) return 'inaccuracy';
  if (loss <= THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

export const BAD_CLASSES: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];

/** Mover's win% (0-100) of a position from the side-to-move's eval. */
function winOf(p: PositionEval) {
  return winPercent(scoreToCp(p.score));
}

/**
 * Material swing for `color` (relative to `fen`) after each ply of a line.
 * Index 0 = after the first move of the line.
 */
function lineSwing(fen: string, line: string[], color: 'w' | 'b', maxPlies: number): number[] {
  const b0 = balance(fen, color);
  return playLine(fen, line, maxPlies).map((f) => balance(f, color) - b0);
}

/** Value at the last ply of `swing` with the given parity (0 = even index), falling back to the last ply. */
function settledAt(swing: number[], parity: 0 | 1): number {
  for (let i = swing.length - 1; i >= 0; i--) if (i % 2 === parity) return swing[i];
  return swing[swing.length - 1] ?? 0;
}

/**
 * Sacrifice: after my move and the opponent's best reply I'm ≥2 pawns down compared with
 * before my move, and my next move in the engine line doesn't win it straight back.
 */
function isSacrifice(fenBefore: string, fenAfter: string, after: PositionEval, color: 'w' | 'b'): boolean {
  const b0 = balance(fenBefore, color);
  const line = playLine(fenAfter, after.pv, 2).map((f) => balance(f, color) - b0);
  if (line.length === 0) return false;
  return line.every((d) => d <= -2);
}

/** After my move, the opponent's best reply captures an undefended (or more valuable) piece of mine and keeps the material. */
function hangingPiece(fenAfter: string, after: PositionEval, color: 'w' | 'b'): boolean {
  const reply = after.pv[0];
  if (!reply) return false;
  const c = new Chess(fenAfter);
  const victim = c.get(reply.slice(2, 4) as Square);
  const attacker = c.get(reply.slice(0, 2) as Square);
  if (!victim || victim.color !== color || victim.type === 'p' || victim.type === 'k' || !attacker) return false;
  const defended = c.isAttacked(reply.slice(2, 4) as Square, color);
  const cheaper = PIECE_VALUE[attacker.type] < PIECE_VALUE[victim.type];
  if (defended && !cheaper) return false;
  // Material after their capture and my best recapture (if any).
  const swing = lineSwing(fenAfter, after.pv, color, 2);
  return settledAt(swing, 1) <= -2 || (swing.length === 1 && swing[0] <= -2);
}

/** The engine's best move won ≥2 pawns of material (within a few plies) or mated, and what I played did not. */
function missedTactic(fenBefore: string, fenAfter: string, before: PositionEval, after: PositionEval, color: 'w' | 'b'): boolean {
  if (before.score.mate !== undefined && before.score.mate > 0) return true;
  const best = lineSwing(fenBefore, before.pv, color, 4);
  if (best.length === 0 || settledAt(best, 1) < 2) return false;
  // What my move actually achieved: my move followed by the engine line from there.
  const b0 = balance(fenBefore, color);
  const mine = [balance(fenAfter, color) - b0, ...playLine(fenAfter, after.pv, 3).map((f) => balance(f, color) - b0)];
  return settledAt(mine, 1) < 2;
}

export function buildAnalysis(game: Game, positions: PositionEval[], depth: number, parsed?: ParsedGame): GameAnalysis {
  const pg = parsed ?? parseGame(game.pgn);
  const { moves: hist, fens, clocks } = pg;
  const phases = gamePhases(fens);
  const tc = parseTimeControl(game.timeControl);
  const eco = parseEcoUrl(pg.headers.ECOUrl ?? game.eco);
  const bookLimit = Math.min(BOOK_MAX_PLIES, eco.plies ?? BOOK_MAX_PLIES);

  const moves: MoveAnalysis[] = [];
  let inBook = true;
  const lastClock: Record<Color, number | undefined> = { white: tc.base, black: tc.base };

  for (let i = 0; i < hist.length; i++) {
    const m = hist[i];
    const color: Color = m.color === 'w' ? 'white' : 'black';
    const before = positions[i];
    const after = positions[i + 1];
    const winBefore = winOf(before);
    const winAfter = 100 - winOf(after);
    const isBest = !!before.best && before.best === m.lan;
    const loss = isBest ? 0 : Math.max(0, winBefore - winAfter) / 100;

    const prev = moves[i - 1];
    const oppPrevMistake = !!prev && prev.loss > THRESHOLDS.inaccuracy;
    const oppJustBlundered = !!prev && prev.loss > THRESHOLDS.mistake;

    let cls: Classification = isBest ? 'best' : baseClass(loss);

    if (inBook && i < bookLimit && loss <= THRESHOLDS.good) cls = 'book';
    else inBook = false;

    if (cls !== 'book') {
      if ((isBest || loss <= THRESHOLDS.excellent) && winBefore >= 10 && winBefore <= 90 && winAfter >= 40) {
        if (isSacrifice(m.before, m.after, after, m.color)) cls = 'brilliant';
      }
      if (oppJustBlundered && loss >= THRESHOLDS.inaccuracy) cls = 'miss';
    }

    const clock = clocks[i];
    let timeSpent: number | undefined;
    if (clock !== undefined && lastClock[color] !== undefined) {
      timeSpent = Math.max(0, lastClock[color]! - clock + tc.inc);
    }
    if (clock !== undefined) lastClock[color] = clock;

    const phase = phases[i];
    const tags: PatternTag[] = [];
    if (BAD_CLASSES.includes(cls)) {
      if (hangingPiece(m.after, after, m.color)) tags.push('hanging-piece');
      if (missedTactic(m.before, m.after, before, after, m.color)) tags.push('missed-tactic');
      if (oppJustBlundered) tags.push('missed-punish');
      const lowClock = !tc.daily && tc.base !== undefined && clock !== undefined && clock < tc.base * 0.1;
      const rushed = !tc.daily && timeSpent !== undefined && timeSpent < 2 && loss >= THRESHOLDS.inaccuracy;
      if (lowClock || rushed) tags.push('time-trouble');
      if (phase === 'endgame' && winBefore >= 70 && winAfter < 60) tags.push('endgame-technique');
      if (phase === 'opening') tags.push('opening-prep');
    }

    moves.push({
      ply: i,
      san: m.san,
      uci: m.lan,
      color,
      fenBefore: m.before,
      classification: cls,
      winBefore,
      winAfter,
      loss,
      accuracy: moveAccuracy(loss * 100),
      phase,
      clock,
      timeSpent,
      piece: m.piece,
      capture: !!m.captured,
      check: m.san.includes('+') || m.san.includes('#'),
      oppPrevMistake,
      bestUci: before.best,
      bestSan: before.best ? uciToSan(m.before, before.best) : undefined,
      tags,
    });
  }

  const counts: ClassCounts = { white: {}, black: {} };
  for (const mv of moves) counts[mv.color][mv.classification] = (counts[mv.color][mv.classification] ?? 0) + 1;

  return {
    gameId: game.id,
    depth,
    createdAt: Date.now(),
    version: ANALYSIS_VERSION,
    positions,
    moves,
    accuracy: {
      white: gameAccuracy(moves.filter((m) => m.color === 'white').map((m) => m.accuracy)),
      black: gameAccuracy(moves.filter((m) => m.color === 'black').map((m) => m.accuracy)),
    },
    counts,
    myColor: game.myColor,
    endTime: game.endTime,
  };
}

/** Eval for terminal positions where the engine has nothing to search. */
export function terminalEval(fen: string): PositionEval | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { fen, score: { mate: 0 }, pv: [], depth: 0 };
  if (c.isDraw() || c.isStalemate()) return { fen, score: { cp: 0 }, pv: [], depth: 0 };
  return null;
}
