import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Arrow } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import type { BookEntry, DrillCard } from '../types/app';
import type { RepertoireDef, RepGame } from '../lib/repertoire';
import { sanMoves } from '../lib/repertoire';
import {
  ALT_TOLERANCE,
  fenAfter,
  fenKey,
  getBook,
  loadCards,
  mainMove,
  newCard,
  opponentReplies,
  pickWeighted,
  reviewCard,
  saveCard,
} from '../lib/book';
import { PRIORITY } from '../engine/engine';
import { navigate, useRoute } from '../lib/router';
import { Header } from '../components/Header';
import { Board } from '../components/Board';
import { Card, Chip, Spinner } from '../components/ui';

type Phase =
  | { kind: 'loading' }
  | { kind: 'thinking' }
  | { kind: 'opponent' }
  | { kind: 'learn'; answer: string }
  | { kind: 'quiz'; answer: string }
  | { kind: 'wrong'; answer: string; played: string }
  | { kind: 'alt'; answer: string; played: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const MOVE_LIMITS = [8, 10, 12] as const;
let savedMoves: number = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const startsWith = (moves: string[], prefix: string[]) => prefix.every((m, i) => moves[i] === m);

function uciArrow(fen: string, san: string, color: string): Arrow | null {
  try {
    const mv = new Chess(fen).move(san);
    return { startSquare: mv.from, endSquare: mv.to, color };
  } catch {
    return null;
  }
}

export function TrainerScreen({ def, games }: { def: RepertoireDef; games: RepGame[] }) {
  const route = useRoute();
  const mode = route.query.get('mode') === 'review' ? 'review' : 'learn';
  const lineName = route.query.get('line');
  const [maxMoves, setMaxMovesState] = useState(savedMoves);
  const maxMovesRef = useRef(maxMoves);
  maxMovesRef.current = maxMoves;
  // Games change while background analysis runs; read them through a ref so the session isn't restarted.
  const gamesRef = useRef(games);
  gamesRef.current = games;

  const startPath = useMemo(() => {
    const line = def.lines.find((l) => l.name === lineName);
    return [...def.root, ...(line?.moves ?? [])];
  }, [def, lineName]);

  const [path, setPath] = useState<string[]>(startPath);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [stats, setStats] = useState({ learned: 0, correct: 0, wrong: 0 });
  const [hint, setHint] = useState<string | null>(null);
  const [run, setRun] = useState(0); // bump to start a new line
  const setMaxMoves = (n: number) => {
    setMaxMovesState((savedMoves = n));
    setRun((r) => r + 1);
  };
  const cards = useRef<Map<string, DrillCard>>(new Map());
  const entryRef = useRef<BookEntry | null>(null);
  const queue = useRef<DrillCard[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const alive = useRef(0);

  const myTurnAt = useCallback((p: string[]) => (p.length % 2 === 0) === (def.color === 'white'), [def.color]);
  const nextMovesInGames = useCallback((p: string[]) => {
    const counts = new Map<string, number>();
    for (const g of gamesRef.current) {
      const s = sanMoves(g.game);
      if (s.length > p.length && startsWith(s, p)) counts.set(s[p.length], (counts.get(s[p.length]) ?? 0) + 1);
    }
    return counts;
  }, []);

  /** Moves the line forward from `p` until it's my turn (or the line ends). */
  const advance = useCallback(
    async (p: string[], token: number) => {
      setPath(p);
      setHint(null);
      if (p.length >= maxMovesRef.current * 2) return setPhase({ kind: 'done' });
      const fen = fenAfter(p);
      setPhase({ kind: 'thinking' });
      let entry: BookEntry;
      try {
        entry = await getBook(fen);
      } catch (e) {
        if (token === alive.current) setPhase({ kind: 'error', message: String((e as Error)?.message ?? e) });
        return;
      }
      if (token !== alive.current) return;
      entryRef.current = entry;
      if (entry.moves.length === 0) return setPhase({ kind: 'done' });
      if (myTurnAt(p)) {
        const usual = [...nextMovesInGames(p).entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const answer = mainMove(entry, usual)!;
        setPhase(cards.current.has(fenKey(fen)) ? { kind: 'quiz', answer } : { kind: 'learn', answer });
        // Warm the cache for the opponent's next position while you think.
        void getBook(fenAfter([...p, answer]), PRIORITY.analysis).catch(() => {});
      } else {
        const san = pickWeighted(opponentReplies(entry, nextMovesInGames(p)));
        if (!san) return setPhase({ kind: 'done' });
        setPhase({ kind: 'opponent' });
        await sleep(450);
        if (token !== alive.current) return;
        void advance([...p, san], token);
      }
    },
    [myTurnAt, nextMovesInGames],
  );

  const nextReview = useCallback(
    (token: number) => {
      const card = queue.current.shift();
      setHint(null);
      if (!card) return setPhase({ kind: 'done' });
      if (token !== alive.current) return;
      setPath(card.path);
      setPhase({ kind: 'quiz', answer: card.answer });
    },
    [],
  );

  // Start (or restart) a session.
  useEffect(() => {
    const token = ++alive.current;
    setStats({ learned: 0, correct: 0, wrong: 0 });
    setPhase({ kind: 'loading' });
    void loadCards(def.id).then((m) => {
      if (token !== alive.current) return;
      cards.current = m;
      const now = Date.now();
      const due = [...m.values()].filter((c) => c.due <= now && startsWith(c.path, startPath)).sort((a, b) => a.due - b.due);
      setDueCount(due.length);
      if (mode === 'review') {
        queue.current = due;
        nextReview(token);
      } else void advance(startPath, token);
    });
    return () => {
      alive.current++;
    };
  }, [def.id, mode, startPath, run, advance, nextReview]);

  const fen = useMemo(() => fenAfter(path), [path]);

  const continueAfter = (p: string[]) => {
    const token = alive.current;
    if (mode === 'review') nextReview(token);
    else void advance(p, token);
  };

  const onMove = (from: string, to: string): boolean => {
    if (phase.kind !== 'learn' && phase.kind !== 'quiz' && phase.kind !== 'wrong') return false;
    let san: string;
    try {
      san = new Chess(fen).move({ from: from as Square, to: to as Square, promotion: 'q' }).san;
    } catch {
      return false;
    }
    const key = fenKey(fen);
    const answer = phase.answer;
    if (phase.kind === 'learn') {
      if (san !== answer) {
        setHint(`Play the move shown by the arrow: ${answer}`);
        return false;
      }
      const c = newCard(def.id, path, answer);
      cards.current.set(key, c);
      void saveCard(c);
      setStats((s) => ({ ...s, learned: s.learned + 1 }));
      continueAfter([...path, san]);
      return true;
    }
    if (phase.kind === 'wrong') {
      if (san !== answer) {
        setHint(`Play ${answer} to continue`);
        return false;
      }
      continueAfter([...path, san]);
      return true;
    }
    // quiz
    const card = cards.current.get(key) ?? newCard(def.id, path, answer);
    if (san === answer) {
      const c = reviewCard(card, true);
      cards.current.set(key, c);
      void saveCard(c);
      setStats((s) => ({ ...s, correct: s.correct + 1 }));
      continueAfter([...path, san]);
      return true;
    }
    const entry = entryRef.current;
    const best = entry?.moves[0]?.win;
    const alt = entry && fenKey(fenAfter(path)) === entry.key ? entry.moves.find((m) => m.san === san) : undefined;
    if (alt && best !== undefined && best - alt.win <= ALT_TOLERANCE) {
      // Equally good: counts as correct, but we continue with the main move.
      const c = reviewCard(card, true);
      cards.current.set(key, c);
      void saveCard(c);
      setStats((s) => ({ ...s, correct: s.correct + 1 }));
      setPhase({ kind: 'alt', answer, played: san });
      setTimeout(() => continueAfter([...path, answer]), 1400);
      return false;
    }
    const c = reviewCard(card, false);
    cards.current.set(key, c);
    void saveCard(c);
    setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    setPhase({ kind: 'wrong', answer, played: san });
    return false;
  };

  const arrows: Arrow[] = [];
  if (phase.kind === 'learn' || phase.kind === 'wrong' || phase.kind === 'alt') {
    const a = uciArrow(fen, phase.answer, 'rgba(129, 182, 76, 0.9)');
    if (a) arrows.push(a);
  }
  const lastMove = useMemo(() => {
    if (path.length === 0) return undefined;
    const c = new Chess();
    let mv;
    for (const san of path) mv = c.move(san);
    return mv ? { from: mv.from, to: mv.to } : undefined;
  }, [path]);

  const canMove = phase.kind === 'learn' || phase.kind === 'quiz' || phase.kind === 'wrong';
  const restart = () => setRun((r) => r + 1);
  const title = lineName ?? def.name;

  return (
    <div className="pb-tabbar">
      <Header title={mode === 'review' ? `Review · ${title}` : `Train · ${title}`} back sub={`As ${def.color} · up to move ${maxMoves}`} />
      <main className="mx-auto max-w-xl px-3 pt-3">
        {mode === 'learn' && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-muted">Moves:</span>
            {MOVE_LIMITS.map((n) => (
              <Chip key={n} on={maxMoves === n} onClick={() => setMaxMoves(n)}>{n}</Chip>
            ))}
          </div>
        )}
        <Board id="trainer" fen={fen} orientation={def.color} lastMove={lastMove} arrows={arrows} onMove={canMove ? onMove : undefined} />

        <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto text-sm">
          {path.map((san, i) => (
            <span key={i} className={`shrink-0 rounded-lg px-1.5 py-0.5 ${i === path.length - 1 ? 'bg-surface-2 text-white' : 'text-muted'}`}>
              {i % 2 === 0 && <span className="text-muted">{i / 2 + 1}.</span>}
              {san}
            </span>
          ))}
        </div>

        <Card className="mt-3">
          {phase.kind === 'loading' || phase.kind === 'thinking' ? (
            <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Stockfish is preparing the position…</div>
          ) : phase.kind === 'opponent' ? (
            <div className="text-sm text-muted">Opponent is moving…</div>
          ) : phase.kind === 'learn' ? (
            <div>
              <div className="font-semibold"><span className="mr-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">New</span> Play <b className="text-win">{phase.answer}</b></div>
              <div className="mt-1 text-sm text-muted">This is the best move here. Play it on the board to learn it.</div>
            </div>
          ) : phase.kind === 'quiz' ? (
            <div>
              <div className="font-semibold">Your move: what’s the best move?</div>
              <div className="mt-1 text-sm text-muted">You’ve seen this position before.</div>
            </div>
          ) : phase.kind === 'wrong' ? (
            <div>
              <div className="font-semibold text-loss">✗ {phase.played} isn’t the move.</div>
              <div className="mt-1 text-sm text-[#d6d4d1]">The best move is <b className="text-win">{phase.answer}</b>. Play it to continue. You’ll see this position again tomorrow.</div>
            </div>
          ) : phase.kind === 'alt' ? (
            <div>
              <div className="font-semibold text-win">✓ {phase.played} is also good</div>
              <div className="mt-1 text-sm text-muted">The main move is <b className="text-[#d6d4d1]">{phase.answer}</b>, we’ll continue with that.</div>
            </div>
          ) : phase.kind === 'error' ? (
            <div className="text-sm text-loss">Engine error: {phase.message}</div>
          ) : (
            <div>
              <div className="text-base font-semibold">{mode === 'review' ? 'Review done!' : 'Line complete!'}</div>
              <div className="mt-1 text-sm text-muted">
                {stats.learned > 0 && `${stats.learned} new move${stats.learned === 1 ? '' : 's'} learned · `}
                {stats.correct} correct · {stats.wrong} wrong
              </div>
              <div className="mt-3 flex gap-2">
                {mode === 'learn' ? (
                  <button onClick={restart} className="h-11 flex-1 rounded-xl bg-accent font-semibold text-[#14200c]">Next line</button>
                ) : (
                  <button onClick={() => navigate(`/openings/${def.id}/train${lineName ? `?line=${encodeURIComponent(lineName)}` : ''}`, true)} className="h-11 flex-1 rounded-xl bg-accent font-semibold text-[#14200c]">
                    Learn new lines
                  </button>
                )}
                <button onClick={() => navigate(`/openings/${def.id}`)} className="h-11 rounded-xl bg-surface-2 px-4 text-sm">Done</button>
              </div>
            </div>
          )}
          {hint && <div className="mt-2 text-sm text-[#e58f2a]">{hint}</div>}
          {phase.kind !== 'done' && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>
                {stats.learned} learned · {stats.correct} ✓ · {stats.wrong} ✗{mode === 'learn' && dueCount > 0 ? ` · ${dueCount} due for review` : ''}
              </span>
              {mode === 'learn' && (
                <button onClick={restart} className="rounded-full bg-surface-2 px-3 py-1.5 text-[#d6d4d1]">↺ New line</button>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
