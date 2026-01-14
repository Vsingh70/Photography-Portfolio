/**
 * Masonry Columns Hook
 *
 * Detects the current number of masonry columns based on viewport width
 * and provides utilities for calculating visual order
 */

'use client';

import { useEffect, useState } from 'react';

/**
 * Breakpoint configuration matching MasonryGrid component
 * Maps max-width to column count
 */
const BREAKPOINTS = [
  { maxWidth: 640, columns: 2 },
  { maxWidth: 768, columns: 2 },
  { maxWidth: 1024, columns: 2 },
  { maxWidth: 1280, columns: 4 },
  { maxWidth: 1536, columns: 4 },
  { maxWidth: Infinity, columns: 4 }, // default
];

/**
 * Hook to detect the current number of masonry columns
 */
export function useMasonryColumns(): number {
  const [columns, setColumns] = useState(4); // Default to 4 columns (SSR safe)

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      const breakpoint = BREAKPOINTS.find((bp) => width <= bp.maxWidth);
      setColumns(breakpoint?.columns ?? 4);
    };

    // Initial check
    updateColumns();

    // Listen for resize
    window.addEventListener('resize', updateColumns);

    return () => {
      window.removeEventListener('resize', updateColumns);
    };
  }, []);

  return columns;
}

/**
 * Convert array index order to visual masonry order (left-to-right, top-to-bottom)
 *
 * react-masonry-css distributes items round-robin across columns:
 * Array order: [0, 1, 2, 3, 4, 5, 6, 7] with 4 columns
 *
 * Visual layout (items distributed round-robin: item 0→col0, item 1→col1, etc.):
 * Col0  Col1  Col2  Col3
 *  0     1     2     3
 *  4     5     6     7
 *
 * Visual reading order (left-to-right, top-to-bottom): 0, 1, 2, 3, 4, 5, 6, 7
 * This matches array order for react-masonry-css!
 *
 * Note: This is different from CSS columns which fill top-to-bottom per column.
 * react-masonry-css uses round-robin distribution, so visual order = array order.
 */
export function getVisualOrder<T>(items: T[]): T[] {
  // react-masonry-css distributes items round-robin across columns,
  // so the visual order (left-to-right, top-to-bottom) matches the array order.
  // No reordering needed - simply return the original array.
  return items;
}

/**
 * Create a mapping from visual index to array index
 * Useful for syncing lightbox navigation with visual order
 *
 * For react-masonry-css, visual index = array index (1:1 mapping)
 */
export function createVisualToArrayIndexMap(
  itemCount: number
): Map<number, number> {
  // react-masonry-css uses round-robin distribution,
  // so visual order matches array order - simple 1:1 mapping
  const map = new Map<number, number>();
  for (let i = 0; i < itemCount; i++) {
    map.set(i, i);
  }
  return map;
}
