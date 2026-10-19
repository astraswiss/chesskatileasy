import { useEffect, useMemo, useState } from 'react';
import type { Arrow } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useGames } from '../lib/games';
import { useAnalyzedGames } from '../hooks/useAnalyzedGames';
import { navigate, useRoute } from '../lib/router';
import {
  REPERTOIRE,
  buildRepertoireReport,
  explore,
  type LineRow,
  type RepertoireReport,
  type RepGame,
} from '../lib/repertoire';
import type { GameAnalysis } from '../types/app';
import { Header } from '../components/Header';
import { TrainerScreen } from './TrainerScreen';
import { TrainerHub } from './TrainerHub';
import { loadCards } from '../lib/book';
import { Board } from '../components/Board';
import { Card, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { ClassIcon } from '../components/ClassIcon';
import { formatDate } from '../components/GameCard';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function useReports() {
  const { games, loaded } = useGames();
  const { pairs, loading } = useAnalyzedGames();
  const reports = useMemo(() => {
    const analyses = new Map<string, GameAnalysis>(pairs.map((p) => [p.game.id, p.analysis]));
    return REPERTOIRE.map((def) => buildRepertoireReport(def, games, analyses));
  }, [games, pairs]);
  return { reports, loading: !loaded || loading, totalGames: games.length };
}

function ScoreBar({ r }: { r: Pick<LineRow, 'wins' | 'draws' | 'losses' | 'games'> }) {
  const w = (x: number) => `${r.games ? (x / r.games) * 100 : 0}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="bg-win" style={{ width: w(r.wins) }} />
      <div className="bg-draw" style={{ width: w(r.draws) }} />
      <div className="bg-loss" style={{ width: w(r.losses) }} />
    </div>
  );
}

/** "How the opening went": my average win chance after move 10, as a short label. */
function winLabel(w?: number) {
  if (w === undefined) return '–';
  const tone = w >= 55 ? 'text-win' : w <= 45 ? 'text-loss' : 'text-[#d6d4d1]';
  return <span className={`tabular-nums ${tone}`}>{Math.round(w)}%</span>;
}

export function OpeningsScreen() {
  const route = useRoute();
  const { reports, loading, totalGames } = useReports();
  const id = route.segments[1];
  const report = id ? reports.find((r) => r.def.id === id) : undefined;
  if (id && report && route.segments[2] === 'train') return <TrainerScreen key={route.query.toString()} def={report.def} games={report.games} />;
  if (id && report && route.segments[2] === 'trainer') return <TrainerHub def={report.def} games={report.games} />;
  if (id && report) return <OpeningDetail report={report} />;

  const covered = reports.reduce((s, r) => s + r.games.length, 0);
  return (
    <div className="pb-tabbar">
      <Header title="Openings" sub="Your repertoire, from your own games" />
      <main className="mx-auto max-w-3xl px-3 pt-3">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <button key={r.def.id} onClick={() => navigate(`/openings/${r.def.id}`)} className="rounded-2xl bg-surface p-4 text-left shadow-soft active:bg-surface-2">
                <div className="flex items-center gap-2">
                  <span className={`h-4 w-4 rounded-full ring-1 ring-white/10 ${r.def.color === 'white' ? 'bg-white' : 'bg-black'}`} />
                  <span className="text-lg font-semibold">{r.def.name}</span>
                  <span className="ml-auto text-sm text-muted">{r.games.length} games</span>
                </div>
                {r.games.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No games yet with 1.{r.def.root.join(' ')} as {r.def.color}.</p>
                ) : (
                  <>
                    <div className="mt-3"><ScoreBar r={r.total} /></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Stat label="score" value={pct(r.total.score)} />
                      <Stat label="opening accuracy" value={r.total.openingAccuracy?.toFixed(1) ?? '–'} />
                      <Stat label="win chance after move 10" value={winLabel(r.total.winAt10)} />
                    </div>
                    {r.lines.length > 1 && (
                      <p className="mt-3 text-sm text-[#d6d4d1]">
                        Most common: <b>{r.lines[0].name}</b> ({r.lines[0].games}).{' '}
                        {weakest(r) && weakest(r)!.name !== r.lines[0].name && (
                          <>Hardest for you: <b className="text-loss">{weakest(r)!.name}</b> ({pct(weakest(r)!.score)}).</>
                        )}
                      </p>
                    )}
                  </>
                )}
              </button>
            ))}
            <p className="px-1 text-xs text-muted">
              {covered} of your {totalGames} cached games are in this repertoire. You can change openings and variation names in src/config.ts.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function weakest(r: RepertoireReport) {
  return [...r.lines].filter((l) => l.games >= 3).sort((a, b) => a.score - b.score)[0];
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-2 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] leading-tight text-muted">{label}</div>
    </div>
  );
}

function OpeningDetail({ report }: { report: RepertoireReport }) {
  const { def, games, lines, mistakes, total } = report;
  const [lineFilter, setLineFilter] = useState<string | null>(null);
  const shownGames = lineFilter ? games.filter((g) => g.line === lineFilter) : games;

  return (
    <div className="pb-tabbar">
      <Header title={def.name} back sub={`As ${def.color} · ${games.length} games · ${total.analyzed} analyzed`} />
      <main className="mx-auto max-w-3xl px-3 pt-3">
        {games.length === 0 ? (
          <EmptyState title="No games in this opening yet" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="score" value={pct(total.score)} />
              <Stat label="opening accuracy" value={total.openingAccuracy?.toFixed(1) ?? '–'} />
              <Stat label="win chance after move 10" value={winLabel(total.winAt10)} />
            </div>

            <TrainCard repId={def.id} line={lineFilter} />

            <SectionTitle>Lines</SectionTitle>
            <Card className="p-0">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-4 pt-3 text-[11px] text-muted">
                <span>Variation</span>
                <span className="w-9 text-right">Games</span>
                <span className="w-10 text-right">Score</span>
                <span className="w-12 text-right" title="Your average win chance after move 10">After 10</span>
              </div>
              {lines.map((l) => (
                <button
                  key={l.name}
                  onClick={() => setLineFilter(lineFilter === l.name ? null : l.name)}
                  className={`grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-4 py-2.5 text-left text-sm ${lineFilter === l.name ? 'bg-accent/10' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block leading-snug">{l.name}</span>
                    <span className="mt-1 block"><ScoreBar r={l} /></span>
                  </span>
                  <span className="w-9 text-right tabular-nums text-muted">{l.games}</span>
                  <span className={`w-10 text-right tabular-nums ${l.games >= 3 && l.score < 0.4 ? 'text-loss' : l.games >= 3 && l.score > 0.6 ? 'text-win' : ''}`}>{pct(l.score)}</span>
                  <span className="w-12 text-right">{winLabel(l.winAt10)}</span>
                </button>
              ))}
              <div className="px-4 pb-3 pt-1 text-xs text-muted">Tap a line to filter the explorer and mistakes below.</div>
            </Card>

            <SectionTitle>Explorer{lineFilter ? ` · ${lineFilter}` : ''}</SectionTitle>
            <Explorer key={lineFilter ?? 'all'} games={shownGames} root={def.root} color={def.color} />

            <SectionTitle>Your opening mistakes{lineFilter ? ` · ${lineFilter}` : ''}</SectionTitle>
            <MistakeList mistakes={lineFilter ? mistakes.filter((m) => m.line === lineFilter) : mistakes} repId={def.id} />
          </>
        )}
      </main>
    </div>
  );
}

function Explorer({ games, root, color }: { games: RepGame[]; root: string[]; color: 'white' | 'black' }) {
  const [path, setPath] = useState<string[]>(root);
  const node = useMemo(() => explore(games, path), [games, path]);
  const lastMove = useMemo(() => {
    if (path.length === 0) return undefined;
    const c = new Chess();
    let mv;
    for (const san of path) mv = c.move(san);
    return mv ? { from: mv.from, to: mv.to } : undefined;
  }, [path]);
  const myUsual = node.myTurn ? node.moves[0] : undefined;
  const arrows: Arrow[] = [];
  if (node.engineBest && myUsual && node.engineBest !== myUsual.san) {
    try {
      const mv = new Chess(node.fen).move(node.engineBest);
      arrows.push({ startSquare: mv.from, endSquare: mv.to, color: 'rgba(129, 182, 76, 0.85)' });
    } catch {
      /* ignore */
    }
  }
  const num = (i: number) => (i % 2 === 0 ? `${i / 2 + 1}.` : '');

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,420px)_1fr]">
      <div>
        <Board id="explorer" fen={node.fen} orientation={color} lastMove={lastMove} arrows={arrows} />
        <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
          <button onClick={() => setPath([])} className="rounded-lg px-1.5 py-0.5 text-muted">Start</button>
          {path.map((san, i) => (
            <button key={i} onClick={() => setPath(path.slice(0, i + 1))} className={`rounded-lg px-1.5 py-0.5 ${i === path.length - 1 ? 'bg-surface-2 text-white' : 'text-[#d6d4d1]'}`}>
              <span className="text-muted">{num(i)}</span>
              {san}
            </button>
          ))}
          {path.length > 0 && (
            <button onClick={() => setPath(path.slice(0, -1))} className="ml-auto h-8 rounded-full bg-surface px-3 text-xs">← Back</button>
          )}
        </div>
      </div>
      <Card>
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium">{node.myTurn ? 'Your move' : 'Opponent’s move'}</span>
          <span className="text-xs text-muted">
            {node.games} game{node.games === 1 ? '' : 's'}
            {node.myWin !== undefined && <> · your win chance {Math.round(node.myWin)}%</>}
          </span>
        </div>
        {node.moves.length === 0 ? (
          <div className="text-sm text-muted">No games continue from here.</div>
        ) : (
          <div className="flex flex-col">
            {node.moves.map((m) => (
              <button key={m.san} onClick={() => setPath([...path, m.san])} className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 text-left text-sm active:bg-surface-2">
                <span className="font-semibold">{m.san}</span>
                <span>
                  <span className="mb-0.5 block text-xs text-muted">
                    {m.count}× · {pct(m.score)}
                    {m.avgLoss !== undefined && m.avgLoss >= 5 && <span className="text-loss"> · −{Math.round(m.avgLoss)}% avg</span>}
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(m.count / node.games) * 100}%` }} />
                  </span>
                </span>
                <span className="text-muted">›</span>
              </button>
            ))}
          </div>
        )}
        {node.engineBest && node.myTurn && (
          <div className="mt-3 rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
            {myUsual && myUsual.san === node.engineBest ? (
              <>Your usual move <b>{myUsual.san}</b> is also Stockfish’s choice. 👍</>
            ) : (
              <>
                Stockfish prefers <b className="text-win">{node.engineBest}</b>
                {myUsual && <> (you usually play <b>{myUsual.san}</b>)</>}.
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function MistakeList({ mistakes, repId }: { mistakes: RepertoireReport['mistakes']; repId: string }) {
  if (mistakes.length === 0) return <Card className="text-sm text-muted">No opening mistakes in your analyzed games here. 🎉</Card>;
  return (
    <>
      <button onClick={() => navigate(`/puzzles?rep=${repId}`)} className="mb-2 h-11 w-full rounded-2xl bg-accent font-semibold text-[#14200c] shadow-soft active:opacity-80">
        Practice these positions
      </button>
      <ul className="flex flex-col gap-2">
        {mistakes.slice(0, 30).map((o) => (
          <li key={`${o.game.id}:${o.move.ply}`}>
            <button
              onClick={() => navigate(`/game/${o.game.id}?ply=${o.move.ply + 1}`)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft active:bg-surface-2"
            >
              <ClassIcon c={o.move.classification} size={26} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {Math.floor(o.move.ply / 2) + 1}{o.move.color === 'white' ? '.' : '...'} {o.move.san}
                  {o.move.bestSan && <span className="text-muted"> · best {o.move.bestSan}</span>}
                </div>
                <div className="truncate text-xs text-muted">{o.line} · vs {o.game.oppName} · {formatDate(o.game.endTime)}</div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-loss">−{Math.round(o.move.loss * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function TrainCard({ repId, line }: { repId: string; line: string | null }) {
  const [counts, setCounts] = useState<{ learned: number; due: number } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCards(repId).then((m) => {
      const now = Date.now();
      if (alive) setCounts({ learned: m.size, due: [...m.values()].filter((c) => c.due <= now).length });
    });
    return () => {
      alive = false;
    };
  }, [repId]);
  const rep = REPERTOIRE.find((r) => r.id === repId);
  const isVariation = !!line && !!rep?.lines.some((l) => l.name === line && l.moves.length > 0 && l.train !== false);
  return (
    <div className="mt-4 rounded-2xl bg-accent/10 p-4 ring-1 ring-accent/20">
      <div className="font-semibold">🎯 Learn the best moves</div>
      <p className="mt-1 text-sm text-[#d6d4d1]">
        Train every variation move by move: a random one each time or the one you choose, and see how many you know 100%.
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => navigate(`/openings/${repId}/trainer`)} className="h-11 flex-1 rounded-xl bg-accent font-semibold text-[#14200c] active:opacity-80">
          Open trainer
        </button>
        {isVariation && (
          <button
            onClick={() => navigate(`/openings/${repId}/train?mode=line&line=${encodeURIComponent(line!)}`)}
            className="h-11 flex-1 rounded-xl bg-surface-2 text-sm"
          >
            Train {line}
          </button>
        )}
      </div>
      {counts && (counts.learned > 0 || counts.due > 0) && (
        <div className="mt-2 text-xs text-muted">{counts.learned} positions learned · {counts.due} due for review</div>
      )}
    </div>
  );
}
