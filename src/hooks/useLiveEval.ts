import { useEffect, useState } from 'react';
import { AbortError, getEngine, PRIORITY, type SearchResult } from '../engine/engine';
import { terminalEval } from '../analysis/build';

/** Streams an engine evaluation for a single position (aborted when the position changes). */
export function useLiveEval(fen: string | null, depth: number) {
  const [result, setResult] = useState<{ fen: string; r: SearchResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fen) return;
    const term = terminalEval(fen);
    if (term) {
      setResult({ fen, r: { score: term.score, pv: [], depth: 0 } });
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      getEngine()
        .search(fen, { depth, priority: PRIORITY.interactive, signal: ac.signal, onInfo: (r) => setResult({ fen, r }) })
        .then((r) => setResult({ fen, r }))
        .catch((e) => {
          if (!(e instanceof AbortError)) setError(String(e?.message ?? e));
        });
    }, 120); // debounce fast scrolling through moves
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [fen, depth]);

  return { result: result && result.fen === fen ? result.r : null, error };
}
