import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Game, GameAnalysis, Puzzle, Settings } from '../types/app';
import { DEFAULT_DEPTH, USERNAME } from '../config';

export interface ArchiveMeta {
  url: string;
  fetchedAt: number;
  /** A month is "final" once it has been fetched after the month ended. */
  final: boolean;
  gameCount: number;
}

interface ChessDB extends DBSchema {
  games: { key: string; value: Game; indexes: { endTime: number } };
  archives: { key: string; value: ArchiveMeta };
  analyses: { key: string; value: GameAnalysis; indexes: { endTime: number } };
  puzzles: { key: string; value: Puzzle; indexes: { due: number } };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<ChessDB>> | null = null;

export function db(): Promise<IDBPDatabase<ChessDB>> {
  if (!dbPromise) {
    // One database per username so changing config.ts starts fresh.
    dbPromise = openDB<ChessDB>(`chess-review-${USERNAME.toLowerCase()}`, 1, {
      upgrade(d) {
        d.createObjectStore('games', { keyPath: 'id' }).createIndex('endTime', 'endTime');
        d.createObjectStore('archives', { keyPath: 'url' });
        d.createObjectStore('analyses', { keyPath: 'gameId' }).createIndex('endTime', 'endTime');
        d.createObjectStore('puzzles', { keyPath: 'id' }).createIndex('due', 'due');
        d.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

// ---- games ----
export async function getAllGames(): Promise<Game[]> {
  const all = await (await db()).getAllFromIndex('games', 'endTime');
  return all.reverse();
}
export async function getGame(id: string) {
  return (await db()).get('games', id);
}
export async function putGames(games: Game[]) {
  const tx = (await db()).transaction('games', 'readwrite');
  await Promise.all([...games.map((g) => tx.store.put(g)), tx.done]);
}

// ---- archives ----
export async function getArchiveMeta(url: string) {
  return (await db()).get('archives', url);
}
export async function putArchiveMeta(meta: ArchiveMeta) {
  await (await db()).put('archives', meta);
}

// ---- analyses ----
export async function getAnalysis(gameId: string) {
  return (await db()).get('analyses', gameId);
}
export async function putAnalysis(a: GameAnalysis) {
  await (await db()).put('analyses', a);
}
export async function getAllAnalyses(): Promise<GameAnalysis[]> {
  const all = await (await db()).getAllFromIndex('analyses', 'endTime');
  return all.reverse();
}
export async function getAnalyzedIds(): Promise<Set<string>> {
  return new Set(await (await db()).getAllKeys('analyses'));
}

// ---- puzzles ----
export async function getAllPuzzles(): Promise<Puzzle[]> {
  return (await db()).getAll('puzzles');
}
export async function getPuzzle(id: string) {
  return (await db()).get('puzzles', id);
}
export async function putPuzzle(p: Puzzle) {
  await (await db()).put('puzzles', p);
}
/** Adds puzzles that don't exist yet (never overwrites spaced-repetition progress). */
export async function addPuzzles(ps: Puzzle[]) {
  const tx = (await db()).transaction('puzzles', 'readwrite');
  for (const p of ps) {
    if (!(await tx.store.getKey(p.id))) await tx.store.put(p);
  }
  await tx.done;
}

// ---- meta / settings ----
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key)) as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key);
}

export const defaultSettings: Settings = {
  depth: DEFAULT_DEPTH,
  autoAnalyze: true,
  autoMaxPerSession: 30,
};

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings, ...((await getMeta<Settings>('settings')) ?? {}) };
}
export async function saveSettings(s: Settings) {
  await setMeta('settings', s);
}

