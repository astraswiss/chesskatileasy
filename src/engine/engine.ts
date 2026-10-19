import type { EngineScore } from '../types/app';

/**
 * Wrapper around the single-threaded lite Stockfish build. The engine runs in its own
 * Web Worker (no SharedArrayBuffer / COOP+COEP needed, so it works on iOS Safari).
 * Requests are queued and served one at a time, highest priority first, so interactive
 * lookups can jump ahead of background game analysis between positions.
 */

export interface SearchResult {
  score: EngineScore;
  best?: string;
  pv: string[];
  depth: number;
  /** With multiPv > 1: the top lines, best first (lines[0] matches score/pv). */
  lines?: { score: EngineScore; pv: string[] }[];
}

export interface SearchOptions {
  depth: number;
  priority?: number; // higher runs first
  signal?: AbortSignal;
  onInfo?: (r: SearchResult) => void;
  /** Number of candidate lines to compute (default 1). */
  multiPv?: number;
}

interface Job {
  fen: string;
  opts: SearchOptions;
  resolve: (r: SearchResult) => void;
  reject: (e: unknown) => void;
  seq: number;
}

export class AbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`;

class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: { job: Job; last: SearchResult | null; aborted: boolean } | null = null;
  private seq = 0;
  private lineHandler: ((line: string) => void) | null = null;

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let w: Worker;
      try {
        w = new Worker(ENGINE_URL);
      } catch (e) {
        reject(e);
        return;
      }
      this.worker = w;
      const timer = setTimeout(() => reject(new Error('Stockfish failed to start')), 20000);
      w.onerror = (e) => {
        clearTimeout(timer);
        this.ready = null;
        reject(new Error(e.message || 'Stockfish worker error'));
      };
      w.onmessage = (e: MessageEvent) => {
        const line = String(e.data);
        if (line === 'readyok' && timer) {
          clearTimeout(timer);
          resolve();
        }
        this.lineHandler?.(line);
      };
      w.postMessage('uci');
      w.postMessage('setoption name Hash value 32');
      w.postMessage('isready');
    });
    return this.ready;
  }

  search(fen: string, opts: SearchOptions): Promise<SearchResult> {
    return new Promise((resolve, reject) => {
      if (opts.signal?.aborted) return reject(new AbortError());
      const job: Job = { fen, opts, resolve, reject, seq: this.seq++ };
      opts.signal?.addEventListener('abort', () => this.abort(job), { once: true });
      this.queue.push(job);
      this.queue.sort((a, b) => (b.opts.priority ?? 0) - (a.opts.priority ?? 0) || a.seq - b.seq);
      void this.pump();
    });
  }

  /** Clears the hash table between unrelated games. */
  async newGame() {
    await this.start();
    if (!this.current) this.worker?.postMessage('ucinewgame');
  }

  private abort(job: Job) {
    const i = this.queue.indexOf(job);
    if (i >= 0) {
      this.queue.splice(i, 1);
      job.reject(new AbortError());
    } else if (this.current?.job === job && !this.current.aborted) {
      this.current.aborted = true;
      this.worker?.postMessage('stop');
    }
  }

  private async pump() {
    if (this.current || this.queue.length === 0) return;
    const job = this.queue.shift()!;
    this.current = { job, last: null, aborted: false };
    try {
      await this.start();
    } catch (e) {
      this.current = null;
      job.reject(e);
      this.queue.splice(0).forEach((j) => j.reject(e));
      return;
    }
    const cur = this.current;
    const multi = new Map<number, { depth: number; score: EngineScore; pv: string[] }>();
    this.lineHandler = (line) => {
      if (line.startsWith('info') && line.includes(' pv ') && !line.includes('bound')) {
        const m = parseInfoMulti(line);
        if (m && m.multipv > 1) {
          multi.set(m.multipv, m);
          return;
        }
        const r = m && m.multipv === 1 ? { score: m.score, pv: m.pv, best: m.pv[0], depth: m.depth } : null;
        if (r && (!cur.last || r.depth >= cur.last.depth)) {
          cur.last = r;
          if (!cur.aborted) job.opts.onInfo?.(r);
        }
      } else if (line.startsWith('bestmove')) {
        this.lineHandler = null;
        this.current = null;
        const best = line.split(' ')[1];
        if (cur.aborted) job.reject(new AbortError());
        else {
          const res: SearchResult = cur.last ?? { score: { cp: 0 }, pv: [], depth: 0 };
          const n = job.opts.multiPv ?? 1;
          const lines =
            n > 1
              ? [{ score: res.score, pv: res.pv }, ...[...multi.entries()].sort((a, b) => a[0] - b[0]).filter(([k]) => k <= n).map(([, v]) => ({ score: v.score, pv: v.pv }))]
              : undefined;
          job.resolve({ ...res, best: best && best !== '(none)' ? best : res.pv[0], lines });
        }
        void this.pump();
      }
    };
    this.worker!.postMessage(`setoption name MultiPV value ${job.opts.multiPv ?? 1}`);
    this.worker!.postMessage(`position fen ${job.fen}`);
    this.worker!.postMessage(`go depth ${job.opts.depth}`);
  }
}

function parseInfoMulti(line: string) {
  const t = line.split(' ');
  let depth = 0;
  let multipv = 1;
  const score: EngineScore = {};
  let pv: string[] = [];
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i]);
        break;
      case 'multipv':
        multipv = Number(t[++i]);
        break;
      case 'score':
        if (t[i + 1] === 'cp') score.cp = Number(t[i + 2]);
        else if (t[i + 1] === 'mate') score.mate = Number(t[i + 2]);
        i += 2;
        break;
      case 'pv':
        pv = t.slice(i + 1);
        i = t.length;
        break;
    }
  }
  if (score.cp === undefined && score.mate === undefined) return null;
  return { multipv, score, pv, depth };
}

let instance: Engine | null = null;
export function getEngine(): Engine {
  return (instance ??= new Engine());
}

export const PRIORITY = { background: 0, analysis: 5, interactive: 10 } as const;
