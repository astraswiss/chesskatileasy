import { Chess, type Color as CColor, type Square } from 'chess.js';

export const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material per side from a FEN's board field. */
export function material(fen: string): { w: number; b: number; wNonPawn: number; bNonPawn: number } {
  const board = fen.split(' ')[0];
  const r = { w: 0, b: 0, wNonPawn: 0, bNonPawn: 0 };
  for (const ch of board) {
    const v = PIECE_VALUE[ch.toLowerCase()];
    if (v === undefined) continue;
    const white = ch === ch.toUpperCase();
    if (white) r.w += v;
    else r.b += v;
    if (ch.toLowerCase() !== 'p') {
      if (white) r.wNonPawn += v;
      else r.bNonPawn += v;
    }
  }
  return r;
}

/** Material balance (own - opponent) for a color. */
export function balance(fen: string, color: CColor): number {
  const m = material(fen);
  return color === 'w' ? m.w - m.b : m.b - m.w;
}

/** Plays up to `max` uci moves from a FEN; returns the FENs reached after each move. */
export function playLine(fen: string, uci: string[], max: number): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of uci.slice(0, max)) {
    try {
      c.move({ from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: u[4] });
    } catch {
      break;
    }
    out.push(c.fen());
  }
  return out;
}

export function uciToSan(fen: string, uci: string): string | undefined {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] }).san;
  } catch {
    return undefined;
  }
}

export function lineToSan(fen: string, uci: string[], max = 12): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of uci.slice(0, max)) {
    try {
      out.push(c.move({ from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: u[4] }).san);
    } catch {
      break;
    }
  }
  return out;
}
