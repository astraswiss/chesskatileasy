import type { Game, GameAnalysis, PositionEval } from '../types/app';
import { getEngine } from '../engine/engine';
import { parseGame } from '../lib/pgn';
import { getAnalysis } from '../lib/db';
import { saveAnalysis } from '../lib/analysisIndex';
import { ANALYSIS_VERSION, buildAnalysis, terminalEval } from './build';

export interface RunOptions {
  depth: number;
  priority: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  /** Awaited between positions (used to pause while the app is hidden). */
  gate?: () => Promise<void>;
}

/** Runs Stockfish on every position of a game, then classifies moves and saves the result. */
export async function analyzeGame(game: Game, opts: RunOptions): Promise<GameAnalysis> {
  const parsed = parseGame(game.pgn);
  const engine = getEngine();
  await engine.newGame();
  const positions: PositionEval[] = [];
  const total = parsed.fens.length;
  opts.onProgress?.(0, total);
  for (let i = 0; i < total; i++) {
    await opts.gate?.();
    const fen = parsed.fens[i];
    const term = terminalEval(fen);
    if (term) positions.push(term);
    else {
      const r = await engine.search(fen, { depth: opts.depth, priority: opts.priority, signal: opts.signal });
      positions.push({ fen, score: r.score, best: r.best, pv: r.pv.slice(0, 12), depth: r.depth });
    }
    opts.onProgress?.(i + 1, total);
  }
  const analysis = buildAnalysis(game, positions, opts.depth, parsed);
  await saveAnalysis(analysis);
  onAnalysisSaved.forEach((fn) => fn(game, analysis));
  return analysis;
}

/** Hooks run after each saved analysis (e.g. puzzle extraction). */
export const onAnalysisSaved = new Set<(g: Game, a: GameAnalysis) => void | Promise<void>>();

/** Loads a stored analysis, re-running classification if the logic changed since it was saved. */
export async function loadAnalysis(game: Game): Promise<GameAnalysis | undefined> {
  const a = await getAnalysis(game.id);
  if (!a) return undefined;
  if (a.version === ANALYSIS_VERSION) return a;
  const rebuilt = buildAnalysis(game, a.positions, a.depth);
  await saveAnalysis(rebuilt);
  onAnalysisSaved.forEach((fn) => fn(game, rebuilt));
  return rebuilt;
}
