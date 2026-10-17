import type { Classification } from '../types/app';

export const CLASS_META: Record<Classification, { label: string; color: string; symbol: string }> = {
  brilliant: { label: 'Brilliant', color: '#1baca6', symbol: '!!' },
  best: { label: 'Best', color: '#81b64c', symbol: '★' },
  excellent: { label: 'Excellent', color: '#96bc4b', symbol: '👍' },
  good: { label: 'Good', color: '#96af8b', symbol: '✓' },
  book: { label: 'Book', color: '#a88865', symbol: '📖' },
  inaccuracy: { label: 'Inaccuracy', color: '#f7c045', symbol: '?!' },
  mistake: { label: 'Mistake', color: '#e58f2a', symbol: '?' },
  miss: { label: 'Miss', color: '#ee6b55', symbol: '✕' },
  blunder: { label: 'Blunder', color: '#ca3431', symbol: '??' },
};

export const CLASS_ORDER: Classification[] = [
  'brilliant',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

function Glyph({ c }: { c: Classification }) {
  // SVG glyphs keep icons crisp and emoji-free across platforms.
  const s = { stroke: 'white', strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (c) {
    case 'best':
      return <path d="M12 5.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L12 15.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="white" />;
    case 'excellent':
      return <path d="M8 11v6M8 11l3-5c1 0 1.8.8 1.6 1.8L12.3 10H16a1.4 1.4 0 0 1 1.4 1.6l-.8 4.4A1.4 1.4 0 0 1 15.2 17H8" {...s} strokeWidth={1.8} />;
    case 'good':
      return <path d="M7.5 12.5l3 3 6-6.5" {...s} />;
    case 'book':
      return <path d="M6.5 7.5c2-.8 4-.6 5.5.6 1.5-1.2 3.5-1.4 5.5-.6v9c-2-.8-4-.6-5.5.6-1.5-1.2-3.5-1.4-5.5-.6zM12 8.1v9" {...s} strokeWidth={1.6} />;
    case 'miss':
      return <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" {...s} />;
    default: {
      const text = CLASS_META[c].symbol;
      return (
        <text x="12" y="16.3" textAnchor="middle" fontSize={text.length > 1 ? 10.5 : 13} fontWeight="800" fill="white" fontFamily="system-ui, sans-serif">
          {text}
        </text>
      );
    }
  }
}

export function ClassIcon({ c, size = 18, className = '' }: { c: Classification; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role="img" aria-label={CLASS_META[c].label}>
      <circle cx="12" cy="12" r="11" fill={CLASS_META[c].color} stroke="rgba(0,0,0,.25)" strokeWidth="1" />
      <Glyph c={c} />
    </svg>
  );
}
