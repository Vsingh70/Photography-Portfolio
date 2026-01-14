/**
 * MasonryGrid Component
 *
 * Responsive masonry layout for gallery images using react-masonry-css
 * Features: infinite scroll, performance optimization, lazy loading
 */

'use client';

import { useState, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import type { GalleryImage } from '@/types/image';
import { useInfiniteScroll } from '@/hooks/useLazyLoad';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface MasonryGridProps {
  images: GalleryImage[];
  onImageClick?: (image: GalleryImage, index: number) => void;
  children?: (image: GalleryImage, index: number) => React.ReactNode;
  className?: string;
  initialLoadCount?: number;
  loadMoreCount?: number;
}

/**
 * Responsive breakpoints for masonry grid columns
 */
const breakpointColumns = {
  default: 4, // 4 columns for extra large screens (1536px+)
  1536: 4, // 4 columns for large desktops
  1280: 4, // 4 columns for desktops (1280px)
  1024: 2, // 2 columns for small desktops (1024px)
  768: 2, // 2 columns for tablets (768px)
  640: 2, // 2 columns for mobile (< 640px)
};

export function MasonryGrid({
  images,
  onImageClick,
  children,
  className = '',
  initialLoadCount = 20,
  loadMoreCount = 12,
}: MasonryGridProps) {
  // Network-aware initial load count
  const { quality } = useNetworkStatus();

  // Adjust initial load based on network quality
  const getInitialCount = () => {
    if (quality === 'low') return 12;
    if (quality === 'medium') return 16;
    return initialLoadCount;
  };

  const [displayCount, setDisplayCount] = useState(getInitialCount());
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Load more images when sentinel is visible
  const loadMore = useCallback(() => {
    if (displayCount >= images.length || isLoadingMore) return;

    setIsLoadingMore(true);

    // Simulate small delay for smooth UX
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + loadMoreCount, images.length));
      setIsLoadingMore(false);
    }, 100);
  }, [displayCount, images.length, isLoadingMore, loadMoreCount]);

  // Infinite scroll sentinel
  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: displayCount < images.length,
  });

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          No images found in this gallery.
        </p>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
          Check back soon for new additions.
        </p>
      </div>
    );
  }

  // Only render images up to displayCount
  const visibleImages = images.slice(0, displayCount);
  const hasMore = displayCount < images.length;

  return (
    <>
      <Masonry
        breakpointCols={breakpointColumns}
        className={`masonry-grid ${className}`}
        columnClassName="masonry-grid-column"
      >
        {visibleImages.map((image, index) => (
          <div
            key={image.id}
            className="masonry-item mb-4 break-inside-avoid"
            onClick={() => onImageClick?.(image, index)}
            role={onImageClick ? 'button' : undefined}
            tabIndex={onImageClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (onImageClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onImageClick(image, index);
              }
            }}
          >
            {children ? children(image, index) : null}
          </div>
        ))}
      </Masonry>

      {/* Infinite scroll sentinel - triggers loading more images */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-400" />
              <span className="text-sm">Loading more images...</span>
            </div>
          )}
        </div>
      )}

      {/* Global styles for masonry grid */}
      <style jsx global>{`
        /* Masonry Grid Styles */
        .masonry-grid {
          display: flex;
          margin-left: -1rem; /* Offset column gap */
          width: auto;
        }

        .masonry-grid-column {
          padding-left: 1rem; /* Column gap */
          background-clip: padding-box;
        }

        .masonry-item {
          margin-bottom: 1rem;
        }

        /* Responsive column gaps */
        @media (max-width: 640px) {
          .masonry-grid {
            margin-left: -0.5rem;
          }

          .masonry-grid-column {
            padding-left: 0.5rem;
          }

          .masonry-item {
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
    </>
  );
}

/**
 * Loading skeleton for MasonryGrid
 */
export function MasonryGridSkeleton({ count = 12 }: { count?: number }) {
  // Random heights for more realistic skeleton
  const heights = Array.from({ length: count }, () => {
    const randomHeight = Math.floor(Math.random() * 200) + 200; // 200-400px
    return randomHeight;
  });

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className="masonry-grid"
      columnClassName="masonry-grid-column"
    >
      {heights.map((height, index) => (
        <div
          key={index}
          className="masonry-item mb-4 animate-pulse"
          style={{ height: `${height}px` }}
        >
          <div className="h-full w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ))}

      <style jsx global>{`
        .masonry-grid {
          display: flex;
          margin-left: -1rem;
          width: auto;
        }

        .masonry-grid-column {
          padding-left: 1rem;
          background-clip: padding-box;
        }

        .masonry-item {
          margin-bottom: 1rem;
        }

        @media (max-width: 640px) {
          .masonry-grid {
            margin-left: -0.5rem;
          }

          .masonry-grid-column {
            padding-left: 0.5rem;
          }

          .masonry-item {
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
    </Masonry>
  );
}
