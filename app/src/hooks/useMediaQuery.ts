'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe `matchMedia` hook. `defaultMatches` is what's returned on the server
 * and the first client render (before the effect runs), so callers can keep the
 * desktop branch as the default and avoid a hydration mismatch / layout flash.
 */
export function useMediaQuery(query: string, defaultMatches = false): boolean {
  const [matches, setMatches] = useState(defaultMatches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

/**
 * True below the 768px desktop breakpoint (the project-wide `md:` threshold).
 * Defaults to desktop (false) on first render so desktop is never flashed the
 * mobile layout; corrects on mount for real mobile devices.
 */
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)', true);
}

/** True on touch-primary devices (coarse pointer). */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)', false);
}
