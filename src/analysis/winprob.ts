import type { EngineScore } from '../types/app';

export const MATE_CP = 10000;

/** Centipawns from the side-to-move perspective; mate scores map to ±10000. */
export function scoreToCp(s: EngineScore): number {
  if (s.mate !== undefined) return s.mate > 0 ? MATE_CP : -MATE_CP; // mate 0 = side to move is mated
  return Math.max(-MATE_CP, Math.min(MATE_CP, s.cp ?? 0));
}

/** Win percentage (0-100) for a centipawn eval. */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Per-move accuracy (0-100) from the win% lost (in percentage points). */
export function moveAccuracy(lossPercent: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, lossPercent)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

/** Average of the arithmetic mean and the harmonic mean. */
export function gameAccuracy(accs: number[]): number {
  if (accs.length === 0) return 0;
  const am = accs.reduce((a, b) => a + b, 0) / accs.length;
  const hm = accs.length / accs.reduce((a, b) => a + 1 / Math.max(b, 1), 0);
  return (am + hm) / 2;
}

/** White-perspective eval in pawns for display (clamped), plus a label. */
export function whiteEval(score: EngineScore, whiteToMove: boolean): { pawns: number; label: string; win: number } {
  const sign = whiteToMove ? 1 : -1;
  if (score.mate !== undefined) {
    const m = score.mate * sign;
    const whiteMates = score.mate === 0 ? !whiteToMove : m > 0;
    return { pawns: whiteMates ? 99 : -99, label: score.mate === 0 ? '#' : `M${Math.abs(score.mate)}`, win: whiteMates ? 100 : 0 };
  }
  const cp = (score.cp ?? 0) * sign;
  const pawns = cp / 100;
  return { pawns, label: (pawns > 0 ? '+' : '') + pawns.toFixed(1), win: winPercent(cp) };
}
