import { useEffect, useMemo, useRef, useState } from 'react';
import { USERNAME } from '../config';
import { useAnalysisIndex } from '../lib/analysisIndex';
import { hasMoreGames, loadMoreGames, refreshGames, useGames } from '../lib/games';
import { navigate } from '../lib/router';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import type { Color, MyResult } from '../types/app';
import type { TimeClass } from '../types/chesscom';
import { GameCard } from '../components/GameCard';
import { Header } from '../components/Header';
import { IconRefresh, IconSettings } from '../components/Icons';
import { Chip, EmptyState, Spinner } from '../components/ui';
import { ErrorBanner } from '../components/ErrorBanner';
import { AnalysisIndicator } from '../components/AnalysisIndicator';

interface Filters {
  tc: TimeClass | 'all';
  result: MyResult | 'all';
  color: Color | 'all';
}
// Kept at module level so filters survive navigating to a game and back.
let savedFilters: Filters = { tc: 'all', result: 'all', color: 'all' };

export function HomeScreen() {
  const s = useGames();
  const { byGame } = useAnalysisIndex();
  const [filters, setFiltersState] = useState<Filters>(savedFilters);
  const setFilters = (f: Partial<Filters>) => {
    savedFilters = { ...filters, ...f };
    setFiltersState(savedFilters);
  };
  const { pull, ready } = usePullToRefresh(() => void refreshGames());

  const visible = useMemo(
    () =>
      s.games.filter(
        (g) =>
          (filters.tc === 'all' || g.timeClass === filters.tc) &&
          (filters.result === 'all' || g.myResult === filters.result) &&
          (filters.color === 'all' || g.myColor === filters.color),
      ),
    [s.games, filters],
  );

  const sentinel = useRef<HTMLDivElement>(null);
  const more = hasMoreGames(s);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || s.error) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMoreGames();
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, s.error, s.loadedMonths]);

  return (
    <div className="pb-tabbar">
      <Header
        title="Games"
        sub={USERNAME}
        right={
          <div className="flex items-center gap-1">
            <AnalysisIndicator />
            <button
              onClick={() => void refreshGames()}
              disabled={s.refreshing}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface"
              aria-label="Refresh games"
            >
              {s.refreshing ? <Spinner /> : <IconRefresh width={20} height={20} />}
            </button>
            <button onClick={() => navigate('/settings')} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface" aria-label="Settings">
              <IconSettings width={20} height={20} />
            </button>
          </div>
        }
      />
      {pull > 0 && (
        <div className="flex items-center justify-center text-xs text-muted transition-[height]" style={{ height: pull }}>
          {ready ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      <main className="mx-auto max-w-3xl px-3 pt-3">
        <div className="no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
          {(['all', 'bullet', 'blitz', 'rapid', 'daily'] as const).map((tc) => (
            <Chip key={tc} on={filters.tc === tc} onClick={() => setFilters({ tc })}>
              {tc === 'all' ? 'All' : tc[0].toUpperCase() + tc.slice(1)}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar -mx-3 mb-3 flex gap-2 overflow-x-auto px-3">
          {(['all', 'win', 'loss', 'draw'] as const).map((r) => (
            <Chip key={r} on={filters.result === r} onClick={() => setFilters({ result: r })}>
              {r === 'all' ? 'Any result' : r === 'win' ? 'Wins' : r === 'loss' ? 'Losses' : 'Draws'}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-border" />
          {(['all', 'white', 'black'] as const).map((c) => (
            <Chip key={c} on={filters.color === c} onClick={() => setFilters({ color: c })}>
              {c === 'all' ? 'Both colors' : c === 'white' ? 'White' : 'Black'}
            </Chip>
          ))}
        </div>

        {s.error && <ErrorBanner error={s.error} hasCache={s.games.length > 0} onRetry={() => void refreshGames()} />}

        {!s.loaded || (s.refreshing && s.games.length === 0) ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title={s.games.length ? 'No games match these filters' : 'No games yet'}>
            {s.games.length ? 'Try a different filter.' : !s.error && 'Play a game on chess.com and pull to refresh.'}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((g) => {
              const a = byGame[g.id];
              return (
                <li key={g.id}>
                  <GameCard game={g} accuracy={a ? a[g.myColor] : undefined} onClick={() => navigate(`/game/${g.id}`)} />
                </li>
              );
            })}
          </ul>
        )}

        {s.loaded && more && (
          <div ref={sentinel} className="flex justify-center py-6">
            <button
              onClick={() => void loadMoreGames()}
              disabled={s.loadingMore}
              className="h-11 rounded-2xl bg-surface shadow-soft px-5 text-sm font-medium"
            >
              {s.loadingMore ? <Spinner /> : 'Load older games'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
