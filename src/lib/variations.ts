import type { BookEntry, DrillCard } from '../types/app';
import type { RepertoireDef, RepGame } from './repertoire';
import { sanMoves } from './repertoire';
import { fenAfter, fenKey, getBook, mainMove } from './book';
import { getBookEntry } from './db';

/** A named variation trained as one fixed main line (like a course chapter). */
export interface Variation {
  name: string;
  moves: string[]; // full defining moves from the start position (root + line)
}

/** The named lines of a repertoire (deduplicated, without the catch-all bucket). */
export function variationsOf(def: RepertoireDef): Variation[] {
  const seen = new Set<string>();
  const out: Variation[] = [];
  for (const l of def.lines) {
    if (l.moves.length === 0 || l.train === false || seen.has(l.name)) continue;
    seen.add(l.name);
    out.push({ name: l.name, moves: [...def.root, ...l.moves] });
  }
  return out;
}

const startsWith = (moves: string[], prefix: string[]) => prefix.every((m, i) => moves[i] === m);

/** Opponent moves played against me at this position, by frequency. */
export function gameReplies(games: RepGame[], path: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of games) {
    const s = sanMoves(g.game);
    if (s.length > path.length && startsWith(s, path)) counts.set(s[path.length], (counts.get(s[path.length]) ?? 0) + 1);
  }
  return counts;
}

export const isMyTurn = (def: RepertoireDef, plies: number) => (plies % 2 === 0) === (def.color === 'white');

/**
 * The move at `path` in a variation's main line: the defining moves first, then my main
 * move (engine/repertoire) or the opponent's most likely reply (what opponents play against
 * me if seen at least twice, else Stockfish's top move).
 */
export function mainLineMove(def: RepertoireDef, v: Variation, games: RepGame[], path: string[], entry: BookEntry): string | undefined {
  if (path.length < v.moves.length) return v.moves[path.length];
  const counts = gameReplies(games, path);
  if (isMyTurn(def, path.length)) {
    const usual = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return mainMove(entry, usual);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) return top[0];
  return entry.moves[0]?.san;
}

export interface Mastery {
  total: number; // my moves in the line up to the move limit
  known: number;
  knownUpTo: number; // full moves known from the start without a gap
  complete: boolean;
}

/** Card counts as known once answered correctly in a review and not failed since. */
export const isKnown = (c?: DrillCard) => !!c && c.stage >= 1;

/**
 * Mastery of a variation's main line, from cached engine data only (positions Stockfish
 * hasn't prepared yet simply count as not known).
 */
export async function variationMastery(
  def: RepertoireDef,
  v: Variation,
  games: RepGame[],
  cards: Map<string, DrillCard>,
  maxPlies: number,
): Promise<Mastery> {
  const path: string[] = [];
  let known = 0;
  let knownUpTo = 0;
  let gap = false;
  const total = Math.ceil((maxPlies - (def.color === 'white' ? 0 : 1)) / 2);
  while (path.length < maxPlies) {
    const fen = fenAfter(path);
    const mine = isMyTurn(def, path.length);
    let next: string | undefined;
    if (path.length < v.moves.length) next = v.moves[path.length];
    else {
      const entry = await getBookEntry(fenKey(fen));
      if (!entry) break;
      next = mainLineMove(def, v, games, path, entry);
    }
    if (!next) break;
    if (mine) {
      if (isKnown(cards.get(fenKey(fen)))) {
        known++;
        if (!gap) knownUpTo = Math.floor(path.length / 2) + 1;
      } else gap = true;
    }
    path.push(next);
  }
  return { total, known, knownUpTo, complete: known >= total };
}

/** Prepares the next engine position of a line in the background (used by the trainer). */
export function prefetch(path: string[]) {
  void getBook(fenAfter(path)).catch(() => {});
}

// Shared "train up to move N" preference for the trainer screens.
let trainMoves = 10;
export const getTrainMoves = () => trainMoves;
export const setTrainMoves = (n: number) => {
  trainMoves = n;
};
