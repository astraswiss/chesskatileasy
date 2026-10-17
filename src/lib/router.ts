import { useSyncExternalStore } from 'react';

/** Minimal hash router: works on any static host (GitHub Pages, Vercel) without rewrites. */
export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

let current = parse();
const listeners = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parse();
  listeners.forEach((l) => l());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function navigate(to: string, replace = false) {
  const hash = '#' + to;
  if (replace) history.replaceState(null, '', hash);
  else history.pushState(null, '', hash);
  current = parse();
  listeners.forEach((l) => l());
}

export function goBack(fallback = '/') {
  if (history.length > 1) history.back();
  else navigate(fallback, true);
}
