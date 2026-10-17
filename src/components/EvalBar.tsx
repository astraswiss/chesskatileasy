/** Vertical evaluation bar. `win` is White's win% (0-100); White's side sits at the bottom unless flipped. */
export function EvalBar({ win, label, flipped }: { win: number; label: string; flipped: boolean }) {
  const whitePct = Math.max(3, Math.min(97, win));
  const whiteAhead = win >= 50;
  const whiteAtBottom = !flipped;
  // The label sits at the far end of the side that is ahead.
  const labelAtBottom = whiteAhead === whiteAtBottom;
  return (
    <div className="relative w-5 shrink-0 self-stretch overflow-hidden rounded bg-[#403d39] sm:w-6" aria-label={`Evaluation ${label}`}>
      <div
        className={`absolute inset-x-0 bg-[#f0f0f0] transition-[height] duration-300 ${whiteAtBottom ? 'bottom-0' : 'top-0'}`}
        style={{ height: `${whitePct}%` }}
      />
      <div
        className={`absolute inset-x-0 text-center text-[9px] font-bold leading-none ${labelAtBottom ? 'bottom-1' : 'top-1'} ${
          whiteAhead ? 'text-[#403d39]' : 'text-[#f0f0f0]'
        }`}
      >
        {label.replace('+', '').replace('-', '')}
      </div>
    </div>
  );
}
