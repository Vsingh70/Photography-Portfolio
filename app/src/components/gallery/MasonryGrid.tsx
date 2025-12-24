/**
 * MasonryGrid Component
 *
 * Responsive masonry layout for gallery images using react-masonry-css
 * Adapts column count based on viewport width
 */

'use client';

import React from 'react';
import Masonry from 'react-masonry-css';
import type { GalleryImage } from '@/types/image';

interface MasonryGridProps {
  images: GalleryImage[];
  onImageClick?: (image: GalleryImage, index: number) => void;
  children?: (image: GalleryImage, index: number) => React.ReactNode;
  className?: string;
}

/**
 * Responsive breakpoints for masonry grid columns
 */
const breakpointColumns = {
  default: 4, // 4 columns for extra large screens (1536px+)
  1536: 3, // 3 columns for large desktops
  1280: 3, // 3 columns for desktops (1280px)
  1024: 3, // 3 columns for small desktops (1024px)
  768: 2, // 2 columns for tablets (768px)
  640: 2, // 2 columns for mobile (< 640px)
};

export function MasonryGrid({ images, onImageClick, children, className = '' }: MasonryGridProps) {
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

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className={`masonry-grid ${className}`}
      columnClassName="masonry-grid-column"
    >
      {images.map((image, index) => (
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
    </Masonry>
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
