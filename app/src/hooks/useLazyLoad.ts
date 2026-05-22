/**
 * Infinite Scroll Hook
 *
 * Uses Intersection Observer to fire a callback when a sentinel
 * element enters the viewport — used for paginated gallery loads.
 */

'use client';

import { useEffect, useRef } from 'react';

export function useInfiniteScroll(
  callback: () => void,
  options: {
    threshold?: number;
    enabled?: boolean;
  } = {}
) {
  const { threshold = 0.5, enabled = true } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (!('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback();
          }
        });
      },
      {
        rootMargin: '200px',
        threshold,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [callback, threshold, enabled]);

  return sentinelRef;
}
