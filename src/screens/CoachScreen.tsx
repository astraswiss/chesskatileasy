import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildCoachReport, type CoachReport, type Occurrence, type Weakness } from '../lib/coach';
import { buildProgress, buildStrengths, type ProgressReport, type Strength } from '../lib/progress';
import { useAnalyzedGames } from '../hooks/useAnalyzedGames';
import { navigate, useRoute } from '../lib/router';
import { Header } from '../components/Header';
import { Card, Chip, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { AnalysisIndicator } from '../components/AnalysisIndicator';
import { ClassIcon } from '../components/ClassIcon';
import { TAG_META } from '../components/tags';
import { formatDate } from '../components/GameCard';
import type { PatternTag } from '../types/app';

let savedRange: 30 | 100 = 30;

function useReport(range: number) {
  const { pairs, loading } = useAnalyzedGames();
  const report = useMemo(() => buildCoachReport(pairs.slice(0, range)), [pairs, range]);
  const progress = useMemo(() => buildProgress(pairs, range), [pairs, range]);
  const good = useMemo(() => buildStrengths(pairs.slice(0, range)), [pairs, range]);
  return { report, progress, good, loading, total: pairs.length };
}

function RangeToggle({ range, setRange }: { range: 30 | 100; setRange: (r: 30 | 100) => void }) {
  return (
    <div className="flex gap-2">
      {([30, 100] as const).map((r) => (
        <Chip key={r} on={range === r} onClick={() => setRange(r)}>
          Last {r}
        </Chip>
      ))}
    </div>
  );
}

function Bar({ value, max = 100, color = '#8fbf6a' }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

export function CoachScreen() {
  const route = useRoute();
  const [range, setRangeState] = useState<30 | 100>(savedRange);
  const setRange = (r: 30 | 100) => setRangeState((savedRange = r));
  const { report, progress, good, loading, total } = useReport(range);
  const tag = route.segments[1] === 'tag' ? (route.segments[2] as PatternTag) : null;

  if (tag) return <WeaknessDetail tag={tag} report={report} loading={loading} />;
  if (route.segments[1] === 'brilliant') return <BrilliantDetail moves={good.brilliants} loading={loading} />;

  return (
    <div className="pb-tabbar">
      <Header title="Coach" sub={total ? `Based on your last ${Math.min(range, total)} analyzed games` : undefined} right={<AnalysisIndicator />} />
      <main className="mx-auto max-w-3xl px-3 pt-3">
        <RangeToggle range={range} setRange={setRange} />
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : report.n === 0 ? (
          <EmptyState title="No analyzed games yet">Games are analyzed automatically in the background, or open one and tap Analyze.</EmptyState>
        ) : (
          <>
            <ProgressSection progress={progress} />
            <StrengthsSection strengths={good.strengths} />
            <CoachBody report={report} />
          </>
        )}
      </main>
    </div>
  );
}

function CoachBody({ report }: { report: CoachReport }) {
  const maxClockAcc = 100;
  return (
    <>
      <SectionTitle>Top weaknesses</SectionTitle>
      {report.weaknesses.length === 0 ? (
        <Card className="text-sm text-muted">No recurring mistake patterns found. Nice!</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {report.weaknesses.map((w, i) => (
            <WeaknessCard key={w.tag} w={w} rank={i + 1} nGames={report.n} />
          ))}
        </div>
      )}

      <SectionTitle>Accuracy by phase</SectionTitle>
      <Card className="flex flex-col gap-3">
        {report.phaseAccuracy.map((p) => (
          <div key={p.phase} className="flex items-center gap-3 text-sm">
            <span className="w-24 capitalize">{p.phase}</span>
            <Bar value={p.accuracy} />
            <span className="w-12 text-right font-semibold tabular-nums">{p.moves ? p.accuracy.toFixed(1) : '–'}</span>
          </div>
        ))}
        <p className="text-xs text-muted">
          Win chance lost per game: {report.phaseAccuracy.map((p) => `${p.phase} ${((p.lost * 100) / report.n).toFixed(1)}%`).join(' · ')}
        </p>
      </Card>

      <SectionTitle>Worst openings</SectionTitle>
      {report.worstOpenings.length === 0 ? (
        <Card className="text-sm text-muted">Play at least 3 analyzed games in an opening to see it here.</Card>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Opening</th>
                <th className="px-1 py-2 text-right font-medium">Games</th>
                <th className="px-1 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {report.worstOpenings.map((o) => (
                <tr key={o.name} className="border-t border-white/5">
                  <td className="px-3 py-2.5 leading-snug">{o.name}</td>
                  <td className="px-1 text-right tabular-nums text-muted">{o.games}</td>
                  <td className="px-1 text-right tabular-nums" style={{ color: o.score < 0.4 ? '#e05252' : o.score > 0.6 ? '#8fbf6a' : undefined }}>
                    {Math.round(o.score * 100)}%
                  </td>
                  <td className="px-3 text-right tabular-nums">{o.accuracy.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <SectionTitle>Time management</SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="text-xs text-muted">Accuracy by clock remaining before the move</div>
        {report.clockBuckets.map((b) => (
          <div key={b.label} className="flex items-center gap-3 text-sm">
            <span className="w-24">{b.label}</span>
            <Bar value={b.accuracy} max={maxClockAcc} color={b.label.startsWith('<') ? '#e58f2a' : '#8fbf6a'} />
            <span className="w-12 text-right font-semibold tabular-nums">{b.moves ? b.accuracy.toFixed(1) : '–'}</span>
            <span className="w-16 text-right text-xs text-muted tabular-nums">{b.moves} moves</span>
          </div>
        ))}
        <div className="flex gap-3 border-t border-white/5 pt-3 text-sm">
          <div className="flex-1">
            <div className="text-2xl font-bold tabular-nums">{report.lostOnTime}</div>
            <div className="text-xs text-muted">games lost on time</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold tabular-nums">{report.timeTroubleGames}</div>
            <div className="text-xs text-muted">games with &lt;10% clock left</div>
          </div>
        </div>
      </Card>

      <SectionTitle>Trend</SectionTitle>
      <Card className="px-1 pb-2 pt-3">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={report.trend} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#2c2f36" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="idx" tick={{ fill: '#8d9199', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="acc" domain={[0, 100]} tick={{ fill: '#8d9199', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="bl" orientation="right" allowDecimals={false} tick={{ fill: '#8d9199', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: '#1c1e22', border: '1px solid #2c2f36', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(_, p) => (p?.[0] ? formatDate(p[0].payload.date) : '')}
                formatter={(v, name) => [Number(v).toFixed(1), name]}
              />
              <Line yAxisId="acc" dataKey="accuracy" name="Accuracy" stroke="#8fbf6a" strokeOpacity={0.25} dot={false} isAnimationActive={false} />
              <Line yAxisId="acc" dataKey="accAvg" name="Accuracy (avg)" stroke="#8fbf6a" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line yAxisId="bl" dataKey="blunderAvg" name="Blunders/game (avg)" stroke="#e2837a" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 px-2 text-xs text-muted">
          <span><span className="mr-1 inline-block h-2 w-3 rounded bg-accent" />Accuracy (rolling avg)</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded bg-[#e2837a]" />Blunders per game</span>
        </div>
      </Card>
    </>
  );
}

function WeaknessCard({ w, rank, nGames }: { w: Weakness; rank: number; nGames: number }) {
  return (
    <button onClick={() => navigate(`/coach/tag/${w.tag}`)} className="rounded-2xl bg-surface shadow-soft p-4 text-left active:bg-surface-2">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-loss/20 text-xs font-bold text-loss">{rank}</span>
        <span className="font-semibold">{w.title}</span>
        <span className="ml-auto text-xs tabular-nums text-muted" title="Win chance lost per game in this range">
          −{(w.totalLoss * 100 / nGames).toFixed(1)}%/game · {w.count}×
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#d6d4d1]">{w.text}</p>
      <div className="mt-2 text-sm font-medium text-accent">See the {w.count} positions →</div>
    </button>
  );
}

function WeaknessDetail({ tag, report, loading }: { tag: PatternTag; report: CoachReport; loading: boolean }) {
  const w = report.allWeaknesses.find((x) => x.tag === tag);
  return (
    <div className="pb-tabbar">
      <Header title={TAG_META[tag]?.label ?? 'Weakness'} back sub={TAG_META[tag]?.description} />
      <main className="mx-auto max-w-3xl px-3 pt-3">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : !w ? (
          <EmptyState title="No positions in this range" />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{w.text}</p>
            <ul className="flex flex-col gap-2">
              {w.occurrences.map((o) => {
                const num = (m: { ply: number; color: string }) => `${Math.floor(m.ply / 2) + 1}${m.color === 'white' ? '.' : '...'}`;
                // For a missed punish, open the position right after the opponent's blunder
                // (before my move), so the board shows their blunder and the arrow shows the punish.
                const punish = tag === 'missed-punish' && o.prev;
                return (
                  <li key={`${o.gameId}:${o.ply}`}>
                    <button
                      onClick={() => navigate(`/game/${o.gameId}?ply=${punish ? o.ply : o.ply + 1}`)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-surface shadow-soft p-3 text-left active:bg-surface-2"
                    >
                      <ClassIcon c={punish ? o.prev!.classification : o.move.classification} size={28} />
                      <div className="min-w-0 flex-1">
                        {punish ? (
                          <>
                            <div className="font-medium">
                              {o.game.oppName}: {num(o.prev!)} {o.prev!.san}
                              <span className="ml-1.5 text-sm font-normal text-loss">−{Math.round(o.prev!.loss * 100)}% for them</span>
                            </div>
                            <div className="text-sm text-muted">
                              Punish: <b className="text-win">{o.move.bestSan}</b> · you played {num(o.move)} {o.move.san}
                            </div>
                          </>
                        ) : (
                          <div className="font-medium">
                            {num(o.move)} {o.move.san}
                            {o.move.bestSan && <span className="text-muted"> · best {o.move.bestSan}</span>}
                          </div>
                        )}
                        <div className="truncate text-xs text-muted">
                          vs {o.game.oppName} · {formatDate(o.game.endTime)} · {o.move.phase}
                          {o.move.clock !== undefined && ` · ${Math.round(o.move.clock)}s left`}
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-loss">−{Math.round(o.move.loss * 100)}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function ProgressSection({ progress }: { progress: ProgressReport | null }) {
  return (
    <>
      <SectionTitle>Your progress</SectionTitle>
      {!progress ? (
        <Card className="text-sm text-muted">Analyze at least 10 games to compare your recent games with earlier ones.</Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="text-xs text-muted">
            Last {progress.recent} games compared with the {progress.previous} before
          </div>
          {progress.items.length === 0 ? (
            <div className="text-sm text-[#d6d4d1]">No big changes yet: your level has been steady. Keep going!</div>
          ) : (
            progress.items.slice(0, 6).map((it) => (
              <div key={it.key} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    it.good ? 'bg-win/15 text-win' : 'bg-[#e58f2a]/15 text-[#e58f2a]'
                  }`}
                  aria-label={it.good ? 'Improved' : 'Declined'}
                >
                  {it.good ? '↑' : '↓'}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{it.title}</div>
                  <div className="text-sm text-muted">{it.text}</div>
                </div>
              </div>
            ))
          )}
        </Card>
      )}
    </>
  );
}

function StrengthsSection({ strengths }: { strengths: Strength[] }) {
  if (strengths.length === 0) return null;
  return (
    <>
      <SectionTitle>Strengths</SectionTitle>
      <div className="flex flex-col gap-2">
        {strengths.map((st) => {
          const body = (
            <>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-win/15 text-xs text-win">★</span>
                <span className="font-medium">{st.title}</span>
                {st.link && <span className="ml-auto text-sm text-accent">→</span>}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#d6d4d1]">{st.text}</p>
            </>
          );
          return st.link ? (
            <button key={st.key} onClick={() => navigate(st.link!)} className="rounded-2xl bg-surface p-4 text-left shadow-soft active:bg-surface-2">
              {body}
            </button>
          ) : (
            <Card key={st.key}>{body}</Card>
          );
        })}
      </div>
    </>
  );
}

function BrilliantDetail({ moves, loading }: { moves: Occurrence[]; loading: boolean }) {
  return (
    <div className="pb-tabbar">
      <Header title="Brilliant moves" back sub="Sound sacrifices you found" />
      <main className="mx-auto max-w-3xl px-3 pt-3">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : moves.length === 0 ? (
          <EmptyState title="No brilliant moves in this range yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {moves.map((o) => (
              <li key={`${o.gameId}:${o.ply}`}>
                <button
                  onClick={() => navigate(`/game/${o.gameId}?ply=${o.ply + 1}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft active:bg-surface-2"
                >
                  <ClassIcon c="brilliant" size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{Math.floor(o.ply / 2) + 1}{o.move.color === 'white' ? '.' : '...'} {o.move.san}</div>
                    <div className="truncate text-xs text-muted">vs {o.game.oppName} · {formatDate(o.game.endTime)} · {o.move.phase}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
