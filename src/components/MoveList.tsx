import { useEffect, useRef } from 'react';
import type { Move } from 'chess.js';
import type { MoveAnalysis } from '../types/app';
import { ClassIcon } from './ClassIcon';

/** Move list in pairs; `current` is the position index (0 = start, k = after move k). */
export function MoveList({
  moves,
  analysis,
  current,
  onSelect,
}: {
  moves: Move[];
  analysis?: MoveAnalysis[];
  current: number;
  onSelect: (ply: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const rows: number[] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push(i);

  const cell = (i: number) => {
    const m = moves[i];
    if (!m) return <span />;
    const a = analysis?.[i];
    const active = current === i + 1;
    return (
      <button
        data-active={active}
        onClick={() => onSelect(i + 1)}
        className={`flex h-9 items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium tabular-nums ${active ? 'bg-surface-2 text-white' : 'text-[#d6d4d1]'}`}
      >
        {a && <ClassIcon c={a.classification} size={16} />}
        <span>{m.san}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 lg:max-h-[340px]">
      {rows.length === 0 && <div className="p-3 text-sm text-muted">No moves.</div>}
      <div className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-1">
        {rows.map((i) => (
          <div key={i} className="contents">
            <span className="flex h-9 items-center justify-end pr-1 text-xs text-muted">{i / 2 + 1}.</span>
            {cell(i)}
            {cell(i + 1)}
          </div>
        ))}
      </div>
    </div>
  );
}
