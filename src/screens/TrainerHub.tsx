import { useEffect, useMemo, useState } from 'react';
import type { DrillCard } from '../types/app';
import type { RepertoireDef, RepGame } from '../lib/repertoire';
import { loadCards } from '../lib/book';
import { getTrainMoves, setTrainMoves, variationMastery, variationsOf, type Mastery } from '../lib/variations';
import { navigate } from '../lib/router';
import { Header } from '../components/Header';
import { Card, Chip, SectionTitle, Spinner } from '../components/ui';
import { MOVE_LIMITS } from './TrainerScreen';

/** Trainer home: random / per-variation training and how well you know each variation. */
export function TrainerHub({ def, games }: { def: RepertoireDef; games: RepGame[] }) {
  const variations = useMemo(() => variationsOf(def), [def]);
  const [moves, setMovesState] = useState(getTrainMoves);
  const setMoves = (n: number) => {
    setTrainMoves(n);
    setMovesState(n);
  };
  const [cards, setCards] = useState<Map<string, DrillCard> | null>(null);
  const [mastery, setMastery] = useState<Mastery[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCards(def.id).then((m) => alive && setCards(m));
    return () => {
      alive = false;
    };
  }, [def.id]);

  useEffect(() => {
    if (!cards) return;
    let alive = true;
    setMastery(null);
    void Promise.all(variations.map((v) => variationMastery(def, v, games, cards, moves * 2))).then((ms) => alive && setMastery(ms));
    return () => {
      alive = false;
    };
    // games only matter for which replies are "most likely"; don't recompute on every analysis update
    // eslint-disable-next-line
  }, [cards, moves, def, variations]);

  const now = Date.now();
  const due = cards ? [...cards.values()].filter((c) => c.due <= now).length : 0;
  const mastered = mastery?.filter((m) => m.complete).length ?? 0;
  const known = mastery?.reduce((s, m) => s + m.known, 0) ?? 0;
  const total = mastery?.reduce((s, m) => s + m.total, 0) ?? 0;

  return (
    <div className="pb-tabbar">
      <Header title={`Trainer · ${def.name}`} back sub={`As ${def.color}`} />
      <main className="mx-auto max-w-3xl px-3 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-muted">Up to move:</span>
          {MOVE_LIMITS.map((n) => (
            <Chip key={n} on={moves === n} onClick={() => setMoves(n)}>{n}</Chip>
          ))}
        </div>

        <Card>
          {!mastery ? (
            <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Counting what you know…</div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{mastered}</span>
                <span className="text-lg text-muted">/ {variations.length}</span>
                <span className="text-sm text-muted">variations known 100% up to move {moves}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${total ? (known / total) * 100 : 0}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-muted">{known} of {total} moves known across all variations</div>
            </>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate(`/openings/${def.id}/train?mode=random`)}
              className="col-span-2 h-12 rounded-xl bg-accent text-base font-semibold text-[#14200c] active:opacity-80"
            >
              🎲 Random variation
            </button>
            <button onClick={() => navigate(`/openings/${def.id}/train?mode=review`)} disabled={!due} className="h-11 rounded-xl bg-surface-2 text-sm disabled:opacity-40">
              Review ({due} due)
            </button>
            <button onClick={() => navigate(`/openings/${def.id}/train`)} className="h-11 rounded-xl bg-surface-2 text-sm" title="Opponent replies vary each time">
              Mixed lines
            </button>
          </div>
        </Card>

        <SectionTitle>Variations</SectionTitle>
        <div className="flex flex-col gap-2">
          {variations.map((v, i) => {
            const m = mastery?.[i];
            const pct = m && m.total ? m.known / m.total : 0;
            return (
              <button
                key={v.name}
                onClick={() => navigate(`/openings/${def.id}/train?mode=line&line=${encodeURIComponent(v.name)}`)}
                className="rounded-2xl bg-surface p-3.5 text-left shadow-soft active:bg-surface-2"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{v.name}</span>
                  {m?.complete ? (
                    <span className="rounded-full bg-win/15 px-2 py-0.5 text-xs font-medium text-win">100% ✓</span>
                  ) : (
                    <span className="text-sm tabular-nums text-muted">{m ? `${Math.round(pct * 100)}%` : '…'}</span>
                  )}
                  <span className="text-muted">›</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full ${m?.complete ? 'bg-win' : 'bg-accent/70'}`} style={{ width: `${pct * 100}%` }} />
                </div>
                <div className="mt-1.5 truncate text-xs text-muted">
                  {movesText(v.moves)}
                  {m && m.known > 0 && !m.complete && <> · known up to move {m.knownUpTo}</>}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 px-1 text-xs text-muted">
          A move counts as known once you’ve answered it correctly in a review (and haven’t got it wrong since).
        </p>
      </main>
    </div>
  );
}

function movesText(moves: string[]) {
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(' ');
}
