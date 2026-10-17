import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGames } from '../lib/games';
import { useAnalyzedGames } from '../hooks/useAnalyzedGames';
import { buildStats, type WDL } from '../lib/stats';
import type { TimeClass } from '../types/chesscom';
import { Header } from '../components/Header';
import { Card, Chip, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { TimeClassIcon } from '../components/Icons';

const axis = { tick: { fill: '#9a9894', fontSize: 11 }, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: '#262421', border: '1px solid #3d3a36', borderRadius: 8, fontSize: 12 };

function WDLBar({ r }: { r: WDL }) {
  const pct = (x: number) => (r.n ? (x / r.n) * 100 : 0);
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="bg-win" style={{ width: `${pct(r.w)}%` }} />
      <div className="bg-draw" style={{ width: `${pct(r.d)}%` }} />
      <div className="bg-loss" style={{ width: `${pct(r.l)}%` }} />
    </div>
  );
}

function WDLRow({ label, r }: { label: React.ReactNode; r: WDL }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex w-24 items-center gap-1.5 capitalize">{label}</span>
      <div className="flex-1">
        <WDLBar r={r} />
        <div className="mt-1 text-xs text-muted tabular-nums">
          {r.w}W · {r.d}D · {r.l}L
        </div>
      </div>
      <span className="w-14 text-right font-semibold tabular-nums">{r.n ? Math.round((r.w / r.n) * 100) : 0}%</span>
    </div>
  );
}

const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function StatsScreen() {
  const { games, loaded } = useGames();
  const { pairs } = useAnalyzedGames();
  const stats = useMemo(() => buildStats(games, pairs), [games, pairs]);
  const ratingClasses = Object.keys(stats.rating) as TimeClass[];
  const [tc, setTc] = useState<TimeClass | null>(null);
  const activeTc = tc && stats.rating[tc] ? tc : (ratingClasses.sort((a, b) => stats.rating[b].length - stats.rating[a].length)[0] ?? null);
  const series = activeTc ? stats.rating[activeTc] : [];

  return (
    <div className="pb-tabbar">
      <Header title="Stats" sub={`${stats.total.n} games cached · ${pairs.length} analyzed`} />
      <main className="mx-auto max-w-3xl px-3">
        {!loaded ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : games.length === 0 ? (
          <EmptyState title="No games yet" />
        ) : (
          <>
            <SectionTitle>Win rate</SectionTitle>
            <Card className="flex flex-col gap-4">
              <WDLRow label="Overall" r={stats.total} />
              <WDLRow label={<><span className="h-3 w-3 rounded-sm bg-white" />White</>} r={stats.byColor.white} />
              <WDLRow label={<><span className="h-3 w-3 rounded-sm border border-border bg-black" />Black</>} r={stats.byColor.black} />
              <div className="border-t border-border" />
              {stats.byTimeClass.map((r) => (
                <WDLRow key={r.tc} label={<><TimeClassIcon tc={r.tc} />{r.tc}</>} r={r} />
              ))}
            </Card>

            <SectionTitle>Rating history</SectionTitle>
            <Card className="px-1 pb-2 pt-3">
              <div className="mb-2 flex gap-2 px-3">
                {ratingClasses.map((c) => (
                  <Chip key={c} on={c === activeTc} onClick={() => setTc(c)}>
                    <span className="capitalize">{c}</span>
                  </Chip>
                ))}
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="#3d3a36" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtDay} {...axis} />
                    <YAxis domain={['dataMin - 20', 'dataMax + 20']} allowDecimals={false} {...axis} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => fmtDay(Number(t))} />
                    <Line dataKey="rating" name="Rating" stroke="#81b64c" strokeWidth={2} dot={series.length < 40} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <SectionTitle>Most played openings</SectionTitle>
            <Card className="flex flex-col gap-4">
              {stats.openings.map((o) => (
                <div key={o.name}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate">{o.name}</span>
                    <span className="shrink-0 text-muted tabular-nums">{o.n} games · {Math.round(((o.w + o.d / 2) / o.n) * 100)}%</span>
                  </div>
                  <WDLBar r={o} />
                </div>
              ))}
            </Card>

            <SectionTitle>Average accuracy over time</SectionTitle>
            <Card className="px-1 pb-2 pt-3">
              {stats.accuracyByMonth.length === 0 ? (
                <div className="px-3 text-sm text-muted">Analyze games to see your accuracy trend.</div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.accuracyByMonth} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke="#3d3a36" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" {...axis} />
                      <YAxis domain={[0, 100]} {...axis} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(v) => [Number(v).toFixed(1), 'Accuracy']} />
                      <Bar dataKey="accuracy" fill="#81b64c" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
