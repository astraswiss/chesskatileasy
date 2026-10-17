import type { Phase } from '../types/app';
import { material } from './material';

const MINOR_HOME: Record<'w' | 'b', [string, string][]> = {
  w: [['b1', 'N'], ['g1', 'N'], ['c1', 'B'], ['f1', 'B']],
  b: [['b8', 'n'], ['g8', 'n'], ['c8', 'b'], ['f8', 'b']],
};

function pieceAt(fen: string, sq: string): string | null {
  const rows = fen.split(' ')[0].split('/');
  const file = sq.charCodeAt(0) - 97;
  const row = rows[8 - Number(sq[1])];
  let f = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) f += Number(ch);
    else {
      if (f === file) return ch;
      f++;
    }
  }
  return null;
}

/** True when no minor piece of that side is still on its starting square. */
export function minorsDeveloped(fen: string, color: 'w' | 'b'): boolean {
  return MINOR_HOME[color].every(([sq, p]) => pieceAt(fen, sq) !== p);
}

export function isEndgame(fen: string): boolean {
  const m = material(fen);
  return m.wNonPawn + m.bNonPawn <= 13;
}

/**
 * Phase of every position in a game (index = position before move i).
 * Opening lasts until move 12 or until both sides developed their minor pieces;
 * endgame once total non-pawn material ≤ 13. Phases never go backwards.
 */
export function gamePhases(fens: string[]): Phase[] {
  let left = false;
  let endgame = false;
  return fens.map((fen) => {
    if (endgame || isEndgame(fen)) {
      endgame = true;
      return 'endgame';
    }
    const fullmove = Number(fen.split(' ')[5] ?? 1);
    if (!left && (fullmove > 12 || (minorsDeveloped(fen, 'w') && minorsDeveloped(fen, 'b')))) left = true;
    return left ? 'middlegame' : 'opening';
  });
}
