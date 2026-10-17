import { useAnalysisQueue } from '../analysis/queue';
import { navigate } from '../lib/router';
import { Spinner } from './ui';

/** Small "Analyzing 3/8…" pill shown while background analysis runs. */
export function AnalysisIndicator() {
  const q = useAnalysisQueue();
  const active = q.current || q.autoQueue.length > 0;
  if (!active || q.autoTotal === 0) return null;
  const n = Math.min(q.autoTotal, q.autoDone + 1);
  return (
    <button
      onClick={() => q.current && navigate(`/game/${q.current.gameId}`)}
      className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-2.5 text-xs text-muted"
      aria-live="polite"
    >
      {q.paused ? <span className="h-2 w-2 rounded-full bg-muted" /> : <Spinner className="h-3 w-3" />}
      <span className="tabular-nums">
        {q.paused ? 'Paused' : 'Analyzing'} {n}/{q.autoTotal}
        {q.current && !q.paused ? '…' : ''}
      </span>
    </button>
  );
}
