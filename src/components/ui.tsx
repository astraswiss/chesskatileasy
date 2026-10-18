import type { ReactNode } from 'react';

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
        on ? 'bg-accent/15 text-accent' : 'bg-surface text-muted active:bg-surface-2'
      }`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface shadow-soft p-4 ${className}`}>{children}</div>;
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-muted border-t-transparent ${className}`} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="text-base font-semibold">{title}</div>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 mt-7 px-1 text-[13px] font-medium text-muted">{children}</h2>;
}
