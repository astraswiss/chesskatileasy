import { Chess, type Square } from 'chess.js';
import type { BookEntry, DrillCard } from '../types/app';
import { getEngine, PRIORITY } from '../engine/engine';
import { scoreToCp, winPercent } from '../analysis/winprob';
import { getBookEntry, getDrillCards, putBookEntry, putDrillCard } from './db';

/** Depth for opening "book" moves: deeper than game analysis, computed once per position and cached. */
export const BOOK_DEPTH = 18;
const CANDIDATES = 4;
/** A repertoire move within this many win% points of Stockfish's top move counts as the main move. */
export const REPERTOIRE_TOLERANCE = 3;
/** A different move within this many points is accepted as "also good". */
export const ALT_TOLERANCE = 2;

export const fenKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export function fenAfter(path: string[]): string {
  const c = new Chess();
  for (const san of path) c.move(san);
  return c.fen();
}

const inflight = new Map<string, Promise<BookEntry>>();

/** Stockfish's top candidate moves for a position (cached in IndexedDB). */
export function getBook(fen: string, priority: number = PRIORITY.interactive): Promise<BookEntry> {
  const key = fenKey(fen);
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const cached = await getBookEntry(key);
    if (cached && cached.depth >= BOOK_DEPTH) return cached;
    const c = new Chess(fen);
    let entry: BookEntry;
    if (c.isGameOver()) entry = { key, depth: BOOK_DEPTH, moves: [] };
    else {
      const r = await getEngine().search(fen, { depth: BOOK_DEPTH, multiPv: CANDIDATES, priority });
      const lines = r.lines ?? [{ score: r.score, pv: r.pv }];
      const moves = lines
        .filter((l) => l.pv[0])
        .map((l) => {
          const u = l.pv[0];
          let san = u;
          try {
            san = new Chess(fen).move({ from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: u[4] }).san;
          } catch {
            /* keep uci */
          }
          return { uci: u, san, win: winPercent(scoreToCp(l.score)) };
        });
      entry = { key, depth: BOOK_DEPTH, moves };
    }
    await putBookEntry(entry);
    return entry;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** The move to learn: Stockfish's best, unless your usual repertoire move is practically as good. */
export function mainMove(entry: BookEntry, usual?: string): string | undefined {
  const best = entry.moves[0];
  if (!best) return undefined;
  const u = usual ? entry.moves.find((m) => m.san === usual) : undefined;
  return u && best.win - u.win <= REPERTOIRE_TOLERANCE ? u.san : best.san;
}

/**
 * Opponent replies to practise against: what opponents actually played against you,
 * plus Stockfish's reasonable candidates. Returns [san, weight] pairs.
 */
export function opponentReplies(entry: BookEntry, fromGames: Map<string, number>): [string, number][] {
  const w = new Map<string, number>();
  for (const [san, n] of fromGames) w.set(san, (w.get(san) ?? 0) + n * 2);
  const best = entry.moves[0]?.win ?? 50;
  entry.moves.forEach((m, i) => {
    if (best - m.win <= 15) w.set(m.san, (w.get(m.san) ?? 0) + (CANDIDATES - i));
  });
  return [...w.entries()];
}

export function pickWeighted(items: [string, number][]): string | undefined {
  const total = items.reduce((s, [, x]) => s + x, 0);
  let r = Math.random() * total;
  for (const [san, x] of items) {
    if ((r -= x) <= 0) return san;
  }
  return items[0]?.[0];
}

// ---- spaced repetition for trainer cards ----
const DAY = 86_400_000;
export const DRILL_INTERVALS_DAYS = [1, 3, 7, 21, 60];

export function newCard(rep: string, path: string[], answer: string, now = Date.now()): DrillCard {
  const fen = fenAfter(path);
  return { id: `${rep}:${fenKey(fen)}`, rep, fenKey: fenKey(fen), fen, path, answer, stage: 0, due: now + DAY, seen: 1, correct: 0, wrong: 0 };
}

export function reviewCard(card: DrillCard, ok: boolean, now = Date.now()): DrillCard {
  const stage = ok ? Math.min(card.stage + 1, DRILL_INTERVALS_DAYS.length - 1) : 0;
  return {
    ...card,
    stage,
    due: now + DRILL_INTERVALS_DAYS[stage] * DAY,
    seen: card.seen + 1,
    correct: card.correct + (ok ? 1 : 0),
    wrong: card.wrong + (ok ? 0 : 1),
  };
}

export async function loadCards(rep: string): Promise<Map<string, DrillCard>> {
  return new Map((await getDrillCards(rep)).map((c) => [c.fenKey, c]));
}

export const saveCard = putDrillCard;
