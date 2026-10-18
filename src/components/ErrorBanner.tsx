import type { ApiError } from '../lib/api';

export function ErrorBanner({ error, hasCache, onRetry }: { error: ApiError; hasCache: boolean; onRetry: () => void }) {
  const title =
    error.kind === 'offline'
      ? 'You are offline'
      : error.kind === 'not-found'
        ? 'User not found'
        : error.kind === 'rate-limited'
          ? 'Too many requests'
          : 'chess.com is unreachable';
  const detail =
    error.kind === 'not-found'
      ? `${error.message} Check USERNAME in src/config.ts.`
      : hasCache
        ? `${error.message} Showing cached games.`
        : error.message;
  return (
    <div role="alert" className="mb-3 flex items-start gap-3 rounded-2xl bg-loss/10 p-3.5 text-sm">
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-muted">{detail}</div>
      </div>
      {error.kind !== 'not-found' && (
        <button onClick={onRetry} className="h-9 rounded-full bg-surface-2 px-4 font-medium">
          Retry
        </button>
      )}
    </div>
  );
}
