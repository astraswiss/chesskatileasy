import { useEffect, useRef, useState } from 'react';

/** Pull-down-to-refresh on the window scroller (mobile). Returns the current pull distance. */
export function usePullToRefresh(onRefresh: () => void, threshold = 70) {
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const dist = useRef(0);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const d = e.touches[0].clientY - start.current;
      dist.current = d > 0 ? Math.min(d * 0.5, threshold * 1.5) : 0;
      setPull(dist.current);
    };
    const onEnd = () => {
      if (start.current !== null && dist.current >= threshold) cb.current();
      start.current = null;
      dist.current = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [threshold]);

  return { pull, ready: pull >= threshold };
}
