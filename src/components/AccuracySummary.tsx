import type { GameAnalysis } from '../types/app';
import { CLASS_META, CLASS_ORDER, ClassIcon } from './ClassIcon';

export function AccuracySummary({ analysis, whiteName, blackName }: { analysis: GameAnalysis; whiteName: string; blackName: string }) {
  const { accuracy, counts } = analysis;
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 text-sm">
        <span />
        <span className="w-20 truncate text-center text-xs text-muted">{whiteName}</span>
        <span className="w-20 truncate text-center text-xs text-muted">{blackName}</span>
        <span className="font-semibold">Accuracy</span>
        <span className="mx-auto rounded-md bg-white px-2 py-1 text-center text-base font-bold tabular-nums text-black">{accuracy.white.toFixed(1)}</span>
        <span className="mx-auto rounded-md bg-[#403d39] px-2 py-1 text-center text-base font-bold tabular-nums text-white">{accuracy.black.toFixed(1)}</span>
        {CLASS_ORDER.map((c) => (
          <div key={c} className="contents">
            <span className="flex items-center gap-2 py-0.5">
              <ClassIcon c={c} size={18} />
              <span style={{ color: CLASS_META[c].color }}>{CLASS_META[c].label}</span>
            </span>
            <span className="text-center tabular-nums" style={{ color: counts.white[c] ? CLASS_META[c].color : undefined }}>
              {counts.white[c] ?? 0}
            </span>
            <span className="text-center tabular-nums" style={{ color: counts.black[c] ? CLASS_META[c].color : undefined }}>
              {counts.black[c] ?? 0}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-right text-[11px] text-muted">Stockfish depth {analysis.depth}</div>
    </div>
  );
}
