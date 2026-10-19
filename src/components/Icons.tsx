import type { SVGProps } from 'react';
import type { TimeClass } from '../types/chesscom';

type P = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IconGames = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
);
export const IconCoach = (p: P) => (
  <svg {...base} {...p}><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /><path d="M9 21h6" /></svg>
);
export const IconBook = (p: P) => (
  <svg {...base} {...p}><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" /><path d="M12 6v13.5" /></svg>
);
export const IconPuzzle = (p: P) => (
  <svg {...base} {...p}><path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7z" /></svg>
);
export const IconStats = (p: P) => (
  <svg {...base} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base} {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base} {...p}><path d="M15 18l-6-6 6-6" /></svg>
);
export const IconPrev = IconBack;
export const IconNext = (p: P) => (
  <svg {...base} {...p}><path d="M9 18l6-6-6-6" /></svg>
);
export const IconFirst = (p: P) => (
  <svg {...base} {...p}><path d="M17 18l-6-6 6-6M7 6v12" /></svg>
);
export const IconLast = (p: P) => (
  <svg {...base} {...p}><path d="M7 18l6-6-6-6M17 6v12" /></svg>
);
export const IconFlip = (p: P) => (
  <svg {...base} {...p}><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base} {...p}><path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></svg>
);

export function TimeClassIcon({ tc, className }: { tc: TimeClass; className?: string }) {
  const props = { ...base, className, width: 18, height: 18 };
  switch (tc) {
    case 'bullet':
      return (
        <svg {...props} stroke="#e3aa24"><path d="M5 19l4-4M14 4l6 6-8 8-6-6 8-8z" /></svg>
      );
    case 'blitz':
      return (
        <svg {...props} stroke="#f7c045" fill="#f7c045"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
      );
    case 'rapid':
      return (
        <svg {...props} stroke="#81b64c"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
      );
    default:
      return (
        <svg {...props} stroke="#e5e7eb"><circle cx="12" cy="12" r="9" /><path d="M12 7v5h4" /><path d="M3 12h2M19 12h2" /></svg>
      );
  }
}
