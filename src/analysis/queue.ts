import { useSyncExternalStore } from 'react';
import { AUTO_DEPTH } from '../config';
import type { Game, GameAnalysis } from '../types/app';
import { AbortError, PRIORITY } from '../engine/engine';
import { getGame } from '../lib/db';
import { createStore } from '../lib/store';
import { analyzeGame } from './runner';

interface Job {
  gameId: string;
  depth: number;
  manual: boolean;
}

interface QueueState {
  current: (Job & { done: number; total: number }) | null;
  autoQueue: string[];
  autoDone: number;
  autoTotal: number;
  paused: boolean;
  lastError: string | null;
}

export const analysisQueue = createStore<QueueState>({
  current: null,
  autoQueue: [],
  autoDone: 0,
  autoTotal: 0,
  paused: typeof document !== 'undefined' && document.hidden,
  lastError: null,
});

export function useAnalysisQueue() {
  return useSyncExternalStore(analysisQueue.subscribe, analysisQueue.get);
}

let manualQueue: Job[] = [];
let running = false;
let controller: AbortController | null = null;
const waiters = new Map<string, { resolve: (a: GameAnalysis) => void; reject: (e: unknown) => void }[]>();

// ---- pause while hidden ----
let resumeResolvers: (() => void)[] = [];
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const paused = document.hidden;
    analysisQueue.set({ paused });
    if (!paused) {
      resumeResolvers.forEach((r) => r());
      resumeResolvers = [];
    }
  });
}
function gate(): Promise<void> {
  if (!analysisQueue.get().paused) return Promise.resolve();
  return new Promise((r) => resumeResolvers.push(r));
}

/** Analyze a game right away (preempts background analysis). */
export function analyzeNow(gameId: string, depth: number): Promise<GameAnalysis> {
  const cur = analysisQueue.get().current;
  const promise = new Promise<GameAnalysis>((resolve, reject) => {
    const list = waiters.get(gameId) ?? [];
    list.push({ resolve, reject });
    waiters.set(gameId, list);
  });
  if (cur?.gameId === gameId && cur.manual && cur.depth === depth) return promise;
  manualQueue = manualQueue.filter((j) => j.gameId !== gameId);
  manualQueue.unshift({ gameId, depth, manual: true });
  if (cur && (!cur.manual || cur.gameId === gameId)) {
    // Put the interrupted auto job back at the front of its queue.
    if (!cur.manual) analysisQueue.set((s) => ({ autoQueue: [cur.gameId, ...s.autoQueue.filter((id) => id !== cur.gameId)] }));
    controller?.abort();
  }
  void run();
  return promise;
}

/** Queue games for background analysis (newest first, one at a time). */
export function enqueueAuto(gameIds: string[]) {
  const s = analysisQueue.get();
  const known = new Set([...s.autoQueue, ...(s.current ? [s.current.gameId] : [])]);
  const add = gameIds.filter((id) => !known.has(id));
  if (add.length === 0) return;
  analysisQueue.set({ autoQueue: [...s.autoQueue, ...add], autoTotal: s.autoTotal + add.length });
  void run();
}

export function cancelAuto() {
  analysisQueue.set({ autoQueue: [], autoTotal: 0, autoDone: 0 });
  if (analysisQueue.get().current && !analysisQueue.get().current!.manual) controller?.abort();
}

async function run() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      let job: Job | undefined = manualQueue.shift();
      if (!job) {
        const s = analysisQueue.get();
        if (s.autoQueue.length === 0) break;
        job = { gameId: s.autoQueue[0], depth: AUTO_DEPTH, manual: false };
        analysisQueue.set({ autoQueue: s.autoQueue.slice(1) });
      }
      const game: Game | undefined = await getGame(job.gameId);
      if (!game) continue;
      controller = new AbortController();
      analysisQueue.set({ current: { ...job, done: 0, total: 1 }, lastError: null });
      try {
        const a = await analyzeGame(game, {
          depth: job.depth,
          priority: job.manual ? PRIORITY.analysis : PRIORITY.background,
          signal: controller.signal,
          gate,
          onProgress: (done, total) =>
            analysisQueue.set((s) => (s.current ? { current: { ...s.current, done, total } } : {})),
        });
        if (!job.manual) analysisQueue.set((s) => ({ autoDone: s.autoDone + 1 }));
        waiters.get(job.gameId)?.forEach((w) => w.resolve(a));
        waiters.delete(job.gameId);
      } catch (e) {
        if (!(e instanceof AbortError)) {
          analysisQueue.set({ lastError: e instanceof Error ? e.message : String(e) });
          waiters.get(job.gameId)?.forEach((w) => w.reject(e));
          waiters.delete(job.gameId);
          if (!job.manual) analysisQueue.set((s) => ({ autoDone: s.autoDone + 1 }));
        }
      } finally {
        analysisQueue.set({ current: null });
      }
      const s = analysisQueue.get();
      if (s.autoQueue.length === 0 && manualQueue.length === 0) analysisQueue.set({ autoDone: 0, autoTotal: 0 });
    }
  } finally {
    running = false;
  }
}
