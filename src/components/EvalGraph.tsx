import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MoveAnalysis } from '../types/app';
import { CLASS_META } from './ClassIcon';

interface Point {
  ply: number;
  v: number; // white advantage in [-1, 1]
}

/** Evaluation across the game. Tap a point to jump to that position. */
export function EvalGraph({
  whiteWins,
  moves,
  current,
  onSelect,
}: {
  whiteWins: number[]; // white win% per position
  moves: MoveAnalysis[];
  current: number;
  onSelect: (ply: number) => void;
}) {
  const data: Point[] = whiteWins.map((w, ply) => ({ ply, v: (w - 50) / 50 }));
  const marks = moves.filter((m) => m.classification === 'blunder' || m.classification === 'mistake' || m.classification === 'brilliant' || m.classification === 'miss');
  return (
    <div className="h-24 w-full select-none overflow-hidden rounded-2xl bg-[#3a3d44]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          onClick={(e) => {
            const idx = e?.activeTooltipIndex ?? e?.activeIndex;
            if (idx !== undefined && idx !== null) onSelect(Number(idx));
          }}
        >
          <XAxis dataKey="ply" hide type="number" domain={[0, Math.max(1, data.length - 1)]} />
          <YAxis hide domain={[-1, 1]} />
          <Tooltip content={() => null} cursor={{ stroke: '#8fbf6a', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="v" stroke="#c9c7bd" strokeWidth={1} fill="#ecebe4" fillOpacity={1} baseValue={-1} isAnimationActive={false} />
          <ReferenceLine y={0} stroke="#777" strokeDasharray="2 2" />
          {marks.map((m) => (
            <ReferenceLine key={m.ply} x={m.ply + 1} stroke={CLASS_META[m.classification].color} strokeWidth={1.5} strokeOpacity={0.9} />
          ))}
          <ReferenceLine x={current} stroke="#8fbf6a" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
