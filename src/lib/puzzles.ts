import type { Game, GameAnalysis, Puzzle } from '../types/app';
import { addPuzzles, getAllAnalyses, getAllGames, getMeta, putPuzzle, setMeta } from './db';

const DAY = 86_400_000;
/** Failed puzzles come back after 1, then 3, then 7 days. */
export const INTERVALS_DAYS = [1, 3, 7];

/** Positions where I blundered, missed a tactic, or made a real mistake in the opening become puzzles. */
export function extractPuzzles(game: Game, a: GameAnalysis): Puzzle[] {
  const now = Date.now();
  return a.moves
    .filter(
      (m) =>
        m.color === a.myColor &&
        m.bestUci &&
        m.bestSan &&
        m.classification !== 'best' &&
        (m.classification === 'blunder' ||
          m.tags.includes('missed-tactic') ||
          (m.phase === 'opening' && (m.classification === 'mistake' || m.classification === 'miss'))),
    )
    .map((m) => ({
      id: `${game.id}:${m.ply}`,
      gameId: game.id,
      ply: m.ply,
      fen: m.fenBefore,
      bestUci: m.bestUci!,
      bestSan: m.bestSan!,
      playedSan: m.san,
      bestWin: m.winBefore,
      tags: m.tags,
      classification: m.classification,
      createdAt: now,
      endTime: game.endTime,
      status: 'new',
      stage: 0,
      due: 0,
      attempts: 0,
      solvedCount: 0,
      failedCount: 0,
    }));
}

export async function savePuzzlesFor(game: Game, a: GameAnalysis) {
  await addPuzzles(extractPuzzles(game, a));
}

export function isDue(p: Puzzle, now = Date.now()) {
  return p.status === 'new' || (p.status === 'failed' && p.due <= now);
}

export async function recordAttempt(p: Puzzle, solved: boolean, now = Date.now()): Promise<Puzzle> {
  const next: Puzzle = { ...p, attempts: p.attempts + 1 };
  if (!solved) {
    next.status = 'failed';
    next.stage = 0;
    next.due = now + INTERVALS_DAYS[0] * DAY;
    next.failedCount++;
  } else {
    next.solvedCount++;
    if (p.status === 'failed') {
      const stage = p.stage + 1;
      if (stage < INTERVALS_DAYS.length) {
        next.stage = stage;
        next.due = now + INTERVALS_DAYS[stage] * DAY;
      } else {
        next.status = 'solved';
        next.due = Number.MAX_SAFE_INTEGER;
      }
    } else {
      next.status = 'solved';
      next.due = Number.MAX_SAFE_INTEGER;
    }
  }
  await putPuzzle(next);
  return next;
}

const BACKFILL_VERSION = 2; // bump when extractPuzzles picks new kinds of positions

/** Creates puzzles for analyses saved before puzzle extraction existed (runs once). */
export async function backfillPuzzles() {
  if ((await getMeta<number>('puzzleBackfill')) === BACKFILL_VERSION) return;
  const games = new Map((await getAllGames()).map((g) => [g.id, g]));
  for (const a of await getAllAnalyses()) {
    const g = games.get(a.gameId);
    if (g) await savePuzzlesFor(g, a);
  }
  await setMeta('puzzleBackfill', BACKFILL_VERSION);
}
