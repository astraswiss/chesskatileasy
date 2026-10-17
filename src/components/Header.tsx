import type { ReactNode } from 'react';
import { goBack } from '../lib/router';
import { IconBack } from './Icons';

export function Header({ title, back, right, sub }: { title: ReactNode; back?: boolean; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur pt-safe">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
        {back && (
          <button onClick={() => goBack()} className="-ml-1 flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface" aria-label="Back">
            <IconBack />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {sub && <div className="truncate text-xs text-muted">{sub}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}
