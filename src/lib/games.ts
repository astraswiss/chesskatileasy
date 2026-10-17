import { useSyncExternalStore } from 'react';
import type { Game } from '../types/app';
import { ApiError, archiveYearMonth, fetchArchives, fetchMonth } from './api';
import { getAllGames, getArchiveMeta, getMeta, putArchiveMeta, putGames, setMeta } from './db';
import { createStore } from './store';

interface GamesState {
  games: Game[];
  loaded: boolean; // cache read finished
  refreshing: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  archives: string[]; // newest first
  loadedMonths: number;
}

export const gamesStore = createStore<GamesState>({
  games: [],
  loaded: false,
  refreshing: false,
  loadingMore: false,
  error: null,
  archives: [],
  loadedMonths: 0,
});

export function useGames() {
  return useSyncExternalStore(gamesStore.subscribe, gamesStore.get);
}

const MIN_INITIAL_GAMES = 25;
const MAX_INITIAL_MONTHS = 4;

function isMonthFinal(url: string, fetchedAt: number): boolean {
  const [y, m] = archiveYearMonth(url);
  // Allow a day of slack for games finishing around midnight UTC.
  return fetchedAt > Date.UTC(y, m, 1) + 86_400_000;
}

async function loadMonth(url: string, force: boolean): Promise<number> {
  const meta = await getArchiveMeta(url);
  if (meta && (meta.final || !force)) return meta.gameCount;
  const games = await fetchMonth(url);
  await putGames(games);
  const fetchedAt = Date.now();
  await putArchiveMeta({ url, fetchedAt, final: isMonthFinal(url, fetchedAt), gameCount: games.length });
  return games.length;
}

async function reloadFromDb() {
  gamesStore.set({ games: await getAllGames(), loaded: true });
}

export async function initGames() {
  const [archives, loadedMonths] = await Promise.all([
    getMeta<string[]>('archives'),
    getMeta<number>('loadedMonths'),
  ]);
  gamesStore.set({ archives: archives ?? [], loadedMonths: loadedMonths ?? 0 });
  await reloadFromDb();
  void refreshGames();
  window.addEventListener('online', () => void refreshGames());
}

let refreshPromise: Promise<void> | null = null;

/** Re-fetches the archive list and any non-final months already loaded. */
export function refreshGames(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    gamesStore.set({ refreshing: true, error: null });
    try {
      const archives = await fetchArchives();
      await setMeta('archives', archives);
      let { loadedMonths } = gamesStore.get();
      gamesStore.set({ archives });
      for (let i = 0; i < Math.min(loadedMonths, archives.length); i++) {
        await loadMonth(archives[i], true);
      }
      // First run: load newest months until there's a reasonable number of games.
      if (loadedMonths === 0) {
        let count = 0;
        while (loadedMonths < archives.length && loadedMonths < MAX_INITIAL_MONTHS && count < MIN_INITIAL_GAMES) {
          count += await loadMonth(archives[loadedMonths], true);
          loadedMonths++;
        }
        await setMeta('loadedMonths', loadedMonths);
        gamesStore.set({ loadedMonths });
      }
      await setMeta('lastRefresh', Date.now());
      await reloadFromDb();
    } catch (e) {
      gamesStore.set({ error: e instanceof ApiError ? e : new ApiError('unknown', String(e)) });
    } finally {
      gamesStore.set({ refreshing: false });
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function loadMoreGames() {
  const s = gamesStore.get();
  if (s.loadingMore || s.loadedMonths >= s.archives.length) return;
  gamesStore.set({ loadingMore: true, error: null });
  try {
    let next = s.loadedMonths;
    let added = 0;
    // Skip over empty months so "load more" always shows something.
    while (next < s.archives.length && added === 0) {
      added = await loadMonth(s.archives[next], false);
      next++;
    }
    await setMeta('loadedMonths', next);
    gamesStore.set({ loadedMonths: next });
    await reloadFromDb();
  } catch (e) {
    gamesStore.set({ error: e instanceof ApiError ? e : new ApiError('unknown', String(e)) });
  } finally {
    gamesStore.set({ loadingMore: false });
  }
}

export function hasMoreGames(s: GamesState) {
  return s.loadedMonths < s.archives.length;
}

export function notifyGamesChanged() {
  void reloadFromDb();
}
