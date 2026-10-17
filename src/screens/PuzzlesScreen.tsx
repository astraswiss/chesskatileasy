import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { Arrow } from 'react-chessboard';
import type { PatternTag, Puzzle } from '../types/app';
import { getAllPuzzles } from '../lib/db';
import { isDue, recordAttempt } from '../lib/puzzles';
import { navigate } from '../lib/router';
import { useAnalysisIndex } from '../lib/analysisIndex';
import { getEngine, PRIORITY } from '../engine/engine';
import { terminalEval } from '../analysis/build';
import { scoreToCp, winPercent } from '../analysis/winprob';
import { Header } from '../components/Header';
import { Board } from '../components/Board';
import { Card, Chip, EmptyState, Spinner } from '../components/ui';
import { TAG_META, TAG_ORDER } from '../components/tags';
import { formatDate } from '../components/GameCard';

const CHECK_DEPTH = 14;
const TOLERANCE = 2; // win% points (= 0.02)

type Verdict = { kind: 'checking' } | { kind: 'correct'; exact: boolean } | { kind: 'wrong'; uci: string; san: string } | { kind: 'revealed' };

let savedTag: PatternTag | 'all' = 'all';

/** Mover's win% after playing `uci` from `fen`, evaluated by the engine. */
async function winAfterMove(fen: string, uci: string): Promise<number> {
  const c = new Chess(fen);
  c.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] });
  const after = c.fen();
  const term = terminalEval(after);
  const score = term ? term.score : (await getEngine().search(after, { depth: CHECK_DEPTH, priority: PRIORITY.interactive })).score;
  return 100 - winPercent(scoreToCp(score));
}

export function PuzzlesScreen() {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [tag, setTagState] = useState<PatternTag | 'all'>(savedTag);
  const setTag = (t: PatternTag | 'all') => setTagState((savedTag = t));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const { version } = useAnalysisIndex();

  useEffect(() => {
    // Small delay: puzzles for a freshly analyzed game are written right after the analysis.
    const t = setTimeout(() => getAllPuzzles().then(setPuzzles), 200);
    return () => clearTimeout(t);
  }, [version]);

  const now = Date.now();
  const filtered = useMemo(() => (puzzles ?? []).filter((p) => tag === 'all' || p.tags.includes(tag)), [puzzles, tag]);
  const queue = useMemo(
    () =>
      filtered
        .filter((p) => isDue(p, now))
        // Due reviews first, then newest games first.
        .sort((a, b) => (a.status === 'failed' ? 0 : 1) - (b.status === 'failed' ? 0 : 1) || b.endTime - a.endTime || a.ply - b.ply),
    [filtered],
  );
  const current = filtered.find((p) => p.id === currentId) ?? queue[0] ?? null;

  const stats = useMemo(() => {
    const all = puzzles ?? [];
    return {
      total: all.length,
      solved: all.filter((p) => p.status === 'solved').length,
      failed: all.filter((p) => p.status === 'failed').length,
      due: all.filter((p) => isDue(p, now)).length,
    };
  }, [puzzles]);

  const onResult = useCallback((p: Puzzle) => {
    setPuzzles((ps) => (ps ? ps.map((x) => (x.id === p.id ? p : x)) : ps));
    setCurrentId(p.id); // stay on it until "Next"
  }, []);

  const next = () => {
    const nextP = queue.find((p) => p.id !== current?.id);
    setCurrentId(nextP?.id ?? null);
  };

  const tagsPresent = TAG_ORDER.filter((t) => (puzzles ?? []).some((p) => p.tags.includes(t)));

  return (
    <div className="pb-tabbar">
      <Header title="Puzzles" sub={puzzles ? `${stats.due} due · ${stats.solved} solved · ${stats.failed} to review · ${stats.total} total` : undefined} />
      <main className="mx-auto max-w-xl px-3 pt-3">
        {tagsPresent.length > 0 && (
          <div className="no-scrollbar -mx-3 mb-3 flex gap-2 overflow-x-auto px-3">
            <Chip on={tag === 'all'} onClick={() => setTag('all')}>All</Chip>
            {tagsPresent.map((t) => (
              <Chip key={t} on={tag === t} onClick={() => setTag(t)}>{TAG_META[t].label}</Chip>
            ))}
          </div>
        )}
        {!puzzles ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : puzzles.length === 0 ? (
          <EmptyState title="No puzzles yet">Puzzles are built from positions where you blundered or missed a tactic. Analyze some games first.</EmptyState>
        ) : !current ? (
          <EmptyState title="All caught up 🎉">No puzzles due{tag !== 'all' ? ' for this filter' : ''}. Failed puzzles come back after 1, 3 and 7 days.</EmptyState>
        ) : (
          <PuzzleView key={current.id} puzzle={current} onResult={onResult} onNext={next} hasNext={queue.some((p) => p.id !== current.id)} />
        )}
      </main>
    </div>
  );
}

function PuzzleView({ puzzle, onResult, onNext, hasNext }: { puzzle: Puzzle; onResult: (p: Puzzle) => void; onNext: () => void; hasNext: boolean }) {
  const [fen, setFen] = useState(puzzle.fen);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bestWin, setBestWin] = useState<number | null>(null);
  const turn = puzzle.fen.split(' ')[1] === 'w' ? 'white' : 'black';
  const done = verdict && verdict.kind !== 'checking';

  // Re-evaluate the best move at the same depth we use for checking answers.
  useEffect(() => {
    let alive = true;
    winAfterMove(puzzle.fen, puzzle.bestUci)
      .then((w) => alive && setBestWin(w))
      .catch(() => alive && setBestWin(puzzle.bestWin));
    return () => {
      alive = false;
    };
    // Only when a different puzzle is shown (attempt counters change the object).
  }, [puzzle.id]);

  const submit = async (from: string, to: string): Promise<boolean> => {
    if (verdict) return false;
    const c = new Chess(puzzle.fen);
    let mv;
    try {
      mv = c.move({ from: from as Square, to: to as Square, promotion: 'q' });
    } catch {
      return false;
    }
    setSelected(null);
    setFen(c.fen());
    const uci = mv.lan;
    if (uci === puzzle.bestUci || c.isCheckmate()) {
      setVerdict({ kind: 'correct', exact: uci === puzzle.bestUci });
      onResult(await recordAttempt(puzzle, true));
      return true;
    }
    setVerdict({ kind: 'checking' });
    try {
      const [mine, best] = await Promise.all([winAfterMove(puzzle.fen, uci), bestWin ?? winAfterMove(puzzle.fen, puzzle.bestUci)]);
      const ok = best - mine <= TOLERANCE;
      setVerdict(ok ? { kind: 'correct', exact: false } : { kind: 'wrong', uci, san: mv.san });
      onResult(await recordAttempt(puzzle, ok));
    } catch {
      setVerdict({ kind: 'wrong', uci, san: mv.san });
      onResult(await recordAttempt(puzzle, false));
    }
    return true;
  };

  const onSquareClick = (sq: string) => {
    if (verdict) return;
    const c = new Chess(fen);
    const piece = c.get(sq as Square);
    if (selected) {
      if (piece && piece.color === c.turn()) setSelected(sq);
      else void submit(selected, sq);
    } else if (piece && piece.color === c.turn()) setSelected(sq);
  };

  const reveal = async () => {
    setVerdict({ kind: 'revealed' });
    onResult(await recordAttempt(puzzle, false));
  };

  const arrows: Arrow[] = [];
  if (verdict?.kind === 'wrong') {
    arrows.push({ startSquare: verdict.uci.slice(0, 2), endSquare: verdict.uci.slice(2, 4), color: 'rgba(202, 52, 49, 0.8)' });
  }
  if (verdict?.kind === 'wrong' || verdict?.kind === 'revealed') {
    arrows.push({ startSquare: puzzle.bestUci.slice(0, 2), endSquare: puzzle.bestUci.slice(2, 4), color: 'rgba(129, 182, 76, 0.9)' });
  }
  const highlight = selected ? { [selected]: { background: 'rgba(129, 182, 76, 0.55)' } } : undefined;
  const shownFen = verdict?.kind === 'wrong' || verdict?.kind === 'revealed' ? puzzle.fen : fen;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-4 w-4 rounded-sm border border-border ${turn === 'white' ? 'bg-white' : 'bg-black'}`} />
        <span className="font-semibold">Find the best move for {turn}</span>
        {puzzle.status === 'failed' && <span className="ml-auto rounded-full bg-[#e58f2a]/20 px-2 py-0.5 text-xs text-[#e58f2a]">Review</span>}
      </div>
      <Board
        id="puzzle"
        fen={shownFen}
        orientation={turn}
        arrows={arrows}
        highlight={highlight}
        onDrop={verdict ? undefined : (from, to) => (void submit(from, to), true)}
        onSquareClick={onSquareClick}
      />

      <Card className="mt-3">
        {!verdict && (
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm text-muted">
              In the game you played <b className="text-[#d6d4d1]">{puzzle.playedSan}</b>. Drag or tap a piece to move.
            </div>
            <button onClick={() => void reveal()} className="h-10 rounded-lg border border-border px-3 text-sm">Solution</button>
          </div>
        )}
        {verdict?.kind === 'checking' && (
          <div className="flex items-center gap-2 text-sm"><Spinner /> Checking with Stockfish…</div>
        )}
        {verdict?.kind === 'correct' && (
          <div className="text-base font-semibold text-win">✓ Correct!{!verdict.exact && <span className="ml-1 text-sm font-normal text-muted">(engine’s top move was {puzzle.bestSan})</span>}</div>
        )}
        {verdict?.kind === 'wrong' && (
          <div className="text-base font-semibold text-loss">
            ✗ {verdict.san} isn’t it. <span className="font-normal text-[#d6d4d1]">Best was <b>{puzzle.bestSan}</b>.</span>
          </div>
        )}
        {verdict?.kind === 'revealed' && (
          <div className="text-base">Solution: <b className="text-win">{puzzle.bestSan}</b></div>
        )}
        {done && (
          <div className="mt-3 flex gap-2">
            {hasNext ? (
              <button onClick={onNext} className="h-11 flex-1 rounded-lg bg-accent font-bold text-black">Next puzzle</button>
            ) : (
              <div className="flex-1 self-center text-sm text-muted">That was the last one due.</div>
            )}
            <button onClick={() => navigate(`/game/${puzzle.gameId}?ply=${puzzle.ply}`)} className="h-11 rounded-lg border border-border px-3 text-sm">
              Open game
            </button>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>{formatDate(puzzle.endTime)}</span>
          {puzzle.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">{TAG_META[t].label}</span>
          ))}
          {puzzle.attempts > 0 && <span>· {puzzle.solvedCount}/{puzzle.attempts} solved</span>}
        </div>
      </Card>
    </div>
  );
}
