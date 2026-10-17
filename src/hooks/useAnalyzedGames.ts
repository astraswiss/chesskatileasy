import { useEffect, useState } from 'react';
import { getAllAnalyses } from '../lib/db';
import { useAnalysisIndex } from '../lib/analysisIndex';
import { useGames } from '../lib/games';
import type { Pair } from '../lib/coach';

/** All analyzed games (newest first) joined with their game records. */
export function useAnalyzedGames(): { pairs: Pair[]; loading: boolean } {
  const { version } = useAnalysisIndex();
  const { games } = useGames();
  const [state, setState] = useState<{ pairs: Pair[]; loading: boolean }>({ pairs: [], loading: true });
  useEffect(() => {
    let alive = true;
    // Debounce: background analysis bumps the version after every game.
    const t = setTimeout(async () => {
      const analyses = await getAllAnalyses();
      const byId = new Map(games.map((g) => [g.id, g]));
      const pairs = analyses.flatMap((a) => {
        const game = byId.get(a.gameId);
        return game ? [{ game, analysis: a }] : [];
      });
      if (alive) setState({ pairs, loading: false });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [version, games]);
  return state;
}
