import { useSyncExternalStore } from 'react';
import type { GameAnalysis } from '../types/app';
import { getAllAnalyses, getMeta, putAnalysis, setMeta } from './db';
import { createStore } from './store';

export interface AnalysisSummary {
  white: number;
  black: number;
  depth: number;
}

/** Lightweight index (gameId → accuracies) so lists don't load every full analysis. */
export const analysisIndex = createStore<{ byGame: Record<string, AnalysisSummary>; version: number }>({
  byGame: {},
  version: 0,
});

export function useAnalysisIndex() {
  return useSyncExternalStore(analysisIndex.subscribe, analysisIndex.get);
}

export async function initAnalysisIndex() {
  let idx = await getMeta<Record<string, AnalysisSummary>>('accIndex');
  if (!idx) {
    idx = {};
    for (const a of await getAllAnalyses()) idx[a.gameId] = { ...a.accuracy, depth: a.depth };
    await setMeta('accIndex', idx);
  }
  analysisIndex.set({ byGame: idx });
}

/** Saves an analysis and updates the index (single write path for analyses). */
export async function saveAnalysis(a: GameAnalysis) {
  await putAnalysis(a);
  const byGame = { ...analysisIndex.get().byGame, [a.gameId]: { ...a.accuracy, depth: a.depth } };
  await setMeta('accIndex', byGame);
  analysisIndex.set((s) => ({ byGame, version: s.version + 1 }));
}
