/**
 * MasonryGrid — row-major masonry via per-column flex buckets.
 *
 * CSS column-count is column-major (top-to-bottom in each column), which
 * scrambles the source order. To preserve row-major reading order, we
 * deal items round-robin into N column buckets, then render those buckets
 * side-by-side. Item 0 → col 0, item 1 → col 1, item 2 → col 2, item 3 → col 0, …
 *
 * Column count is responsive: 2 on mobile, 3 on tablet+. A ResizeObserver
 * on a sentinel element reads the active count from a CSS custom property.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GalleryImage } from '@/types/image';
import { useInfiniteScroll } from '@/hooks/useLazyLoad';

interface MasonryGridProps {
  images: GalleryImage[];
  children: (image: GalleryImage, index: number) => React.ReactNode;
  initialLoadCount?: number;
  loadMoreCount?: number;
}

function useColumnCount(): number {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setCols(mq.matches ? 3 : 2);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return cols;
}

export function MasonryGrid({
  images,
  children,
  initialLoadCount = 20,
  loadMoreCount = 16,
}: MasonryGridProps) {
  const [displayCount, setDisplayCount] = useState(initialLoadCount);
  const columnCount = useColumnCount();

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + loadMoreCount, images.length));
  }, [images.length, loadMoreCount]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: displayCount < images.length,
  });

  const visibleImages = useMemo(
    () => images.slice(0, displayCount),
    [images, displayCount]
  );

  // Round-robin distribute so row-major reading order is preserved.
  const columns = useMemo(() => {
    const buckets: Array<Array<{ image: GalleryImage; index: number }>> =
      Array.from({ length: columnCount }, () => []);
    visibleImages.forEach((image, index) => {
      buckets[index % columnCount].push({ image, index });
    });
    return buckets;
  }, [visibleImages, columnCount]);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-lg italic text-primary-700 dark:text-primary-300">
          No images found in this gallery.
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary-500 dark:text-primary-500">
          Check back soon
        </p>
      </div>
    );
  }

  const hasMore = displayCount < images.length;

  return (
    <>
      <div className="masonry">
        {columns.map((bucket, colIdx) => (
          <div key={colIdx} className="masonry-col">
            {bucket.map(({ image, index }) => (
              <MasonryCellRef key={image.id}>
                {children(image, index)}
              </MasonryCellRef>
            ))}
          </div>
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-2" />}

      <style jsx global>{`
        .masonry {
          display: flex;
          gap: 0.625rem;
          align-items: flex-start;
        }
        .masonry-col {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 768px) {
          .masonry {
            gap: 1.375rem;
          }
        }
      `}</style>
    </>
  );
}

function MasonryCellRef({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
