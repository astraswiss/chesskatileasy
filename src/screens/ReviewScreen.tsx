import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Arrow } from 'react-chessboard';
import type { Game, GameAnalysis } from '../types/app';
import { getGame } from '../lib/db';
import { parseGame, formatTimeControl, parseTimeControl } from '../lib/pgn';
import { useRoute } from '../lib/router';
import { useSettings } from '../lib/settings';
import { useAnalysisIndex } from '../lib/analysisIndex';
import { analyzeNow, useAnalysisQueue } from '../analysis/queue';
import { loadAnalysis } from '../analysis/runner';
import { BAD_CLASSES } from '../analysis/build';
import { lineToSan } from '../analysis/material';
import { whiteEval } from '../analysis/winprob';
import { useLiveEval } from '../hooks/useLiveEval';
import { Header } from '../components/Header';
import { Board } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { EvalGraph } from '../components/EvalGraph';
import { MoveList } from '../components/MoveList';
import { AccuracySummary } from '../components/AccuracySummary';
import { CLASS_META, ClassIcon } from '../components/ClassIcon';
import { IconExternal, IconFirst, IconFlip, IconLast, IconNext, IconPrev } from '../components/Icons';
import { EmptyState, ProgressBar, Spinner } from '../components/ui';
import { describeResult, formatDate } from '../components/GameCard';
import { TAG_META } from '../components/tags';

function fmtClock(s?: number) {
  if (s === undefined) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(sec)).padStart(2, '0')}`;
  if (s < 20) return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
  return `${m}:${String(Math.floor(sec)).padStart(2, '0')}`;
}

export function ReviewScreen({ gameId }: { gameId: string }) {
  const route = useRoute();
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [analysis, setAnalysis] = useState<GameAnalysis | undefined>();
  const [ply, setPly] = useState(() => Number(route.query.get('ply') ?? 0) || 0);
  const [flipped, setFlipped] = useState(false);
  const settings = useSettings();
  const queue = useAnalysisQueue();
  const { version } = useAnalysisIndex();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getGame(gameId).then((g) => alive && setGame(g ?? null));
    return () => {
      alive = false;
    };
  }, [gameId]);

  // Load (or reload after an analysis finishes) the stored analysis.
  useEffect(() => {
    if (!game) return;
    let alive = true;
    loadAnalysis(game).then((a) => alive && setAnalysis(a));
    return () => {
      alive = false;
    };
  }, [game, version]);

  // Jump to the ply from the URL when it changes (e.g. coming from Coach).
  const qPly = route.query.get('ply');
  useEffect(() => {
    if (qPly !== null) setPly(Number(qPly) || 0);
  }, [qPly, gameId]);

  const parsed = useMemo(() => (game ? parseGame(game.pgn) : null), [game]);
  const n = parsed?.moves.length ?? 0;
  const go = useCallback((p: number) => setPly(Math.max(0, Math.min(n, p))), [n]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') go(ply - 1);
      else if (e.key === 'ArrowRight') go(ply + 1);
      else if (e.key === 'ArrowUp' || e.key === 'Home') go(0);
      else if (e.key === 'ArrowDown' || e.key === 'End') go(n);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, ply, n]);

  // Swipe navigation on the board.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(ply + (dx < 0 ? 1 : -1));
  };

  const fen = parsed?.fens[ply] ?? null;
  const stored = analysis?.positions[ply];
  const live = useLiveEval(stored ? null : fen, Math.min(settings.depth, 18));
  const evalNow = stored ?? (live.result ? { score: live.result.score, pv: live.result.pv, best: live.result.best, depth: live.result.depth } : null);

  if (game === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (game === null || !parsed || !fen) {
    return (
      <>
        <Header title="Game" back />
        <EmptyState title="Game not found">It may not be cached on this device yet.</EmptyState>
      </>
    );
  }

  const orientation = (game.myColor === 'white') !== flipped ? 'white' : 'black';
  const whiteToMove = fen.split(' ')[1] === 'w';
  const ev = evalNow ? whiteEval(evalNow.score, whiteToMove) : { win: 50, label: '…', pawns: 0 };
  const lastMove = ply > 0 ? parsed.moves[ply - 1] : undefined;
  const lastA = ply > 0 ? analysis?.moves[ply - 1] : undefined;

  const arrows: Arrow[] = [];
  if (evalNow?.best && evalNow.best.length >= 4) {
    arrows.push({ startSquare: evalNow.best.slice(0, 2), endSquare: evalNow.best.slice(2, 4), color: 'rgba(129, 182, 76, 0.85)' });
  }
  const lineSan = evalNow ? lineToSan(fen, evalNow.pv, 10) : [];
  const moveNo = Math.floor(ply / 2) + 1;

  const clockOf = (color: 'w' | 'b') => {
    for (let i = ply - 1; i >= 0; i--) if (parsed.moves[i].color === color) return parsed.clocks[i];
    return parsed.clocks.length ? parseTimeControl(game.timeControl).base : undefined;
  };
  const whiteName = game.myColor === 'white' ? 'You' : game.oppName;
  const blackName = game.myColor === 'black' ? 'You' : game.oppName;
  const player = (color: 'w' | 'b') => {
    const isMe = (color === 'w') === (game.myColor === 'white');
    const name = isMe ? 'You' : game.oppName;
    const rating = isMe ? game.myRating : game.oppRating;
    const acc = analysis ? analysis.accuracy[color === 'w' ? 'white' : 'black'] : undefined;
    const active = (color === 'w') === whiteToMove;
    return (
      <div className="flex items-center gap-2 px-1 py-1.5">
        <span className={`h-4 w-4 rounded-sm border border-border ${color === 'w' ? 'bg-white' : 'bg-black'}`} />
        <span className="truncate font-semibold">{name}</span>
        <span className="text-sm text-muted">({rating})</span>
        {acc !== undefined && <span className="text-xs text-muted">{acc.toFixed(1)}%</span>}
        <span className={`ml-auto rounded px-2 py-0.5 font-mono text-sm tabular-nums ${active ? 'bg-white text-black' : 'bg-surface-2 text-muted'}`}>
          {fmtClock(clockOf(color)) || '–'}
        </span>
      </div>
    );
  };
  const topColor = orientation === 'white' ? 'b' : 'w';

  const running = queue.current?.gameId === game.id ? queue.current : null;
  const needsDeeper = analysis && analysis.depth < settings.depth;

  const startAnalysis = () => {
    setError(null);
    analyzeNow(game.id, settings.depth).catch((e) => setError(String(e?.message ?? e)));
  };

  const whiteWins = analysis ? analysis.positions.map((p, i) => whiteEval(p.score, parsed.fens[i].split(' ')[1] === 'w').win) : null;

  return (
    <div className="pb-safe">
      <Header
        title={`vs ${game.oppName}`}
        back
        sub={`${game.opening} · ${formatTimeControl(game.timeControl)} · ${formatDate(game.endTime)}`}
        right={
          <a href={game.url} target="_blank" rel="noreferrer" className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface" aria-label="Open on chess.com">
            <IconExternal width={20} height={20} />
          </a>
        }
      />
      <main className="mx-auto max-w-5xl px-2 pt-2 lg:grid lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-5 lg:px-4">
        <section>
          {player(topColor)}
          <div className="flex gap-1.5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <EvalBar win={ev.win} label={ev.label} flipped={orientation === 'black'} />
            <div className="min-w-0 flex-1">
              <Board
                fen={fen}
                orientation={orientation}
                lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : undefined}
                badge={lastA && lastMove ? { square: lastMove.to, c: lastA.classification } : undefined}
                arrows={arrows}
              />
            </div>
          </div>
          {player(topColor === 'w' ? 'b' : 'w')}

          <div className="mt-1 grid grid-cols-5 gap-1.5">
            <NavBtn label="First move" onClick={() => go(0)} disabled={ply === 0}><IconFirst /></NavBtn>
            <NavBtn label="Previous move" onClick={() => go(ply - 1)} disabled={ply === 0}><IconPrev /></NavBtn>
            <NavBtn label="Next move" onClick={() => go(ply + 1)} disabled={ply === n} primary><IconNext /></NavBtn>
            <NavBtn label="Last move" onClick={() => go(n)} disabled={ply === n}><IconLast /></NavBtn>
            <NavBtn label="Flip board" onClick={() => setFlipped((f) => !f)}><IconFlip /></NavBtn>
          </div>
        </section>

        <section className="mt-3 flex flex-col gap-3 lg:mt-0">
          {/* Current move verdict */}
          <div className="min-h-[64px] rounded-xl border border-border bg-surface p-3">
            {lastA ? (
              <div className="flex items-start gap-3">
                <ClassIcon c={lastA.classification} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    <span>{Math.floor((ply - 1) / 2) + 1}{lastA.color === 'white' ? '.' : '...'} {lastA.san}</span>{' '}
                    <span style={{ color: CLASS_META[lastA.classification].color }}>
                      is {lastA.classification === 'book' ? 'a book move' : lastA.classification === 'best' ? 'the best move' : `${/^[aeiou]/.test(lastA.classification) ? 'an' : 'a'} ${CLASS_META[lastA.classification].label.toLowerCase()}`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    {lastA.classification !== 'best' && lastA.classification !== 'book' && lastA.bestSan && <>Best was <b className="text-[#d6d4d1]">{lastA.bestSan}</b> · </>}
                    {lastA.loss > 0 ? `−${(lastA.loss * 100).toFixed(1)}% win chance` : 'No win chance lost'}
                    {lastA.timeSpent !== undefined && ` · ${lastA.timeSpent.toFixed(1)}s`}
                  </div>
                  {lastA.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {lastA.tags.map((t) => (
                        <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-[#d6d4d1]">{TAG_META[t].label}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted">
                {ply === 0 ? `Start position · ${describeResult(game)}` : lastMove ? `${Math.floor((ply - 1) / 2) + 1}${lastMove.color === 'w' ? '.' : '...'} ${lastMove.san}` : ''}
                {!analysis && ' · Analyze the game to classify moves.'}
              </div>
            )}
          </div>

          {/* Engine line */}
          <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-bold ${ev.win >= 50 ? 'bg-white text-black' : 'bg-[#403d39] text-white'}`}>{ev.label}</span>
              <span className="text-xs text-muted">{evalNow ? `depth ${evalNow.depth}${stored ? '' : ' · live'}` : live.error ? 'engine error' : 'thinking…'}</span>
            </div>
            <div className="mt-1 line-clamp-2 font-mono text-[13px] leading-snug text-[#d6d4d1]">
              {lineSan.length ? lineSan.map((s, i) => {
                const num = whiteToMove ? (i % 2 === 0 ? `${moveNo + i / 2}. ` : '') : i === 0 ? `${moveNo}... ` : i % 2 === 1 ? `${moveNo + (i + 1) / 2}. ` : '';
                return <span key={i}>{num}{s} </span>;
              }) : <span className="text-muted">{live.error ?? (evalNow ? 'Game over' : '')}</span>}
            </div>
          </div>

          {whiteWins && analysis && <EvalGraph whiteWins={whiteWins} moves={analysis.moves} current={ply} onSelect={go} />}

          {/* Analyze */}
          {running ? (
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="mb-2 flex justify-between text-sm">
                <span>Analyzing{running.manual ? '' : ' (background)'}… depth {running.depth}</span>
                <span className="tabular-nums text-muted">{running.done}/{running.total}</span>
              </div>
              <ProgressBar value={running.total ? running.done / running.total : 0} />
              {!running.manual && (
                <button onClick={startAnalysis} className="mt-2 text-sm text-accent">Analyze now at depth {settings.depth}</button>
              )}
            </div>
          ) : !analysis ? (
            <button onClick={startAnalysis} className="h-12 rounded-xl bg-accent text-base font-bold text-black active:opacity-80">
              Analyze game (depth {settings.depth})
            </button>
          ) : needsDeeper ? (
            <button onClick={startAnalysis} className="h-10 rounded-xl border border-border bg-surface text-sm text-muted">
              Analyzed at depth {analysis.depth} · re-analyze at depth {settings.depth}
            </button>
          ) : null}
          {(error || (queue.lastError && running === null && !analysis)) && (
            <div className="rounded-lg border border-loss/40 bg-loss/10 p-2 text-sm">Analysis failed: {error ?? queue.lastError}</div>
          )}

          <MoveList moves={parsed.moves} analysis={analysis?.moves} current={ply} onSelect={go} />

          {analysis && <AccuracySummary analysis={analysis} whiteName={whiteName} blackName={blackName} />}
          {analysis && <KeyMoments analysis={analysis} onSelect={go} />}
        </section>
      </main>
    </div>
  );
}

function NavBtn({ children, onClick, disabled, label, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; primary?: boolean }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 items-center justify-center rounded-lg ${primary ? 'bg-surface-2' : 'bg-surface'} disabled:opacity-40 active:bg-border`}
    >
      {children}
    </button>
  );
}

function KeyMoments({ analysis, onSelect }: { analysis: GameAnalysis; onSelect: (ply: number) => void }) {
  const mine = analysis.moves.filter((m) => m.color === analysis.myColor && (BAD_CLASSES.includes(m.classification) || m.classification === 'brilliant'));
  if (mine.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 text-sm font-semibold">Your key moments</div>
      <div className="flex flex-col">
        {mine.map((m) => (
          <button key={m.ply} onClick={() => onSelect(m.ply + 1)} className="flex items-center gap-2 rounded-md px-1 py-2 text-left text-sm active:bg-surface-2">
            <ClassIcon c={m.classification} size={18} />
            <span className="w-16 shrink-0 font-medium">{Math.floor(m.ply / 2) + 1}{m.color === 'white' ? '.' : '...'} {m.san}</span>
            <span className="truncate text-muted">
              {m.bestSan && m.classification !== 'brilliant' ? `best ${m.bestSan} · ` : ''}−{(m.loss * 100).toFixed(0)}%
              {m.tags.length ? ` · ${m.tags.map((t) => TAG_META[t].short).join(', ')}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
