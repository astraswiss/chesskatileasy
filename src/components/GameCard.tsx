import type { Game } from '../types/app';
import { formatTimeControl } from '../lib/pgn';
import { TimeClassIcon } from './Icons';

const resultStyle = {
  win: 'bg-win text-black',
  loss: 'bg-loss text-white',
  draw: 'bg-draw text-black',
} as const;
const resultLabel = { win: 'W', loss: 'L', draw: 'D' } as const;

const resultText: Record<string, string> = {
  checkmated: 'checkmate',
  timeout: 'on time',
  resigned: 'resignation',
  abandoned: 'abandoned',
  agreed: 'agreement',
  repetition: 'repetition',
  stalemate: 'stalemate',
  insufficient: 'insufficient material',
  '50move': '50-move rule',
  timevsinsufficient: 'timeout vs insufficient',
};

export function describeResult(g: Game) {
  const how = resultText[g.myResult === 'win' ? g.oppResultDetail : g.myResultDetail] ?? '';
  const word = g.myResult === 'win' ? 'Won' : g.myResult === 'loss' ? 'Lost' : 'Draw';
  return how ? `${word} by ${how}` : word;
}

export function formatDate(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function GameCard({ game, accuracy, onClick }: { game: Game; accuracy?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-left active:bg-surface-2"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-bold ${resultStyle[game.myResult]}`}>
        {resultLabel[game.myResult]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-3 w-3 shrink-0 rounded-sm border border-border ${game.myColor === 'white' ? 'bg-black' : 'bg-white'}`}
            title={`Opponent plays ${game.myColor === 'white' ? 'black' : 'white'}`}
          />
          <span className="truncate font-semibold">{game.oppName}</span>
          <span className="shrink-0 text-sm text-muted">({game.oppRating})</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">{game.opening}</div>
        <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
          <TimeClassIcon tc={game.timeClass} />
          <span>{formatTimeControl(game.timeControl)}</span>
          <span>·</span>
          <span>{formatDate(game.endTime)}</span>
          <span>·</span>
          <span className="truncate">{describeResult(game)}</span>
        </div>
      </div>
      <div className="w-12 shrink-0 text-right">
        {accuracy !== undefined ? (
          <>
            <div className="text-lg font-bold tabular-nums">{accuracy.toFixed(1)}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">accuracy</div>
          </>
        ) : (
          <div className="text-sm text-muted" title="Not analyzed yet">–</div>
        )}
      </div>
    </button>
  );
}
