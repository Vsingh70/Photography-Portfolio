/**
 * GalleryCard Component
 *
 * Individual image card with Next.js Image optimization, hover effects, and metadata overlay
 * Features: lazy loading, blur placeholders, network-aware loading
 */

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { GalleryImage } from '@/types/image';
import { useLazyLoad } from '@/hooks/useLazyLoad';
import { useNetworkStatus, shouldPreload } from '@/hooks/useNetworkStatus';

interface GalleryCardProps {
  image: GalleryImage;
  priority?: boolean;
  onClick?: () => void;
  sizes?: string;
}

export function GalleryCard({
  image,
  priority = false,
  onClick,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: GalleryCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showBlur, setShowBlur] = useState(true);

  // Lazy load images that aren't priority
  const { ref, isVisible } = useLazyLoad<HTMLDivElement>({
    enabled: !priority,
    rootMargin: '200px', // Start loading earlier for smoother experience
  });

  // Get network status for smart preloading
  const { quality } = useNetworkStatus();

  // Smart preload full-size image on hover (only on fast connections)
  const handleMouseEnter = () => {
    if (!shouldPreload(quality)) return;

    if (image.src && image.src !== image.thumbnail && isLoaded) {
      const img = new window.Image();
      img.src = image.src;
    }
  };

  // Hide blur placeholder after main image loads
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => setShowBlur(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  // Determine if we should load the image (priority or visible)
  const shouldLoad = priority || isVisible;

  return (
    <div
      ref={ref}
      className="group relative overflow-hidden rounded-lg bg-neutral-100 shadow-sm transition-all duration-300 hover:shadow-lg dark:bg-neutral-900"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Image */}
      <div className="relative aspect-auto">
        {/* Blur placeholder - loads immediately from Google Drive CDN (no auth required) */}
        {showBlur && image.blurDataURL && (
          <Image
            src={image.blurDataURL}
            alt=""
            width={image.width}
            height={image.height}
            className="absolute inset-0 h-auto w-full object-cover blur-lg scale-110"
            quality={60}
            loading="eager"
            unoptimized={true}
          />
        )}

        {/* Main image - lazy loaded based on visibility */}
        {shouldLoad && !hasError ? (
          <Image
            src={image.thumbnail || image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes={sizes}
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            unoptimized={true} // Skip Next.js processing - already optimized by Sharp
            className={`
              relative h-auto w-full object-cover transition-all duration-500
              ${isLoaded ? 'scale-100 blur-0 opacity-100' : 'scale-105 blur-sm opacity-0'}
              ${onClick ? 'cursor-pointer group-hover:scale-105' : ''}
            `}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        ) : hasError ? (
          <div className="flex h-64 items-center justify-center bg-neutral-200 dark:bg-neutral-800">
            <p className="text-sm text-neutral-500">Failed to load image</p>
          </div>
        ) : (
          // Placeholder for lazy-loaded images not yet visible
          <div className="flex h-64 items-center justify-center bg-neutral-200 dark:bg-neutral-800">
            <div className="h-12 w-12 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700" />
          </div>
        )}

        {/* Loading state */}
        {shouldLoad && !isLoaded && !hasError && (
          <div className="absolute inset-0 animate-pulse bg-neutral-200/50 dark:bg-neutral-800/50" />
        )}
      </div>

      {/* Hover Overlay with Metadata */}
      {onClick && (
        <div
          className="
            absolute inset-0 flex flex-col justify-end bg-gradient-to-t
            from-black/70 via-black/20 to-transparent p-4 opacity-0
            transition-opacity duration-300 group-hover:opacity-100
          "
        >
          {/* Title */}
          {image.title && (
            <h3 className="mb-1 text-lg font-semibold text-white">{image.title}</h3>
          )}

          {/* Description */}
          {image.description && (
            <p className="mb-2 line-clamp-2 text-sm text-white/90">{image.description}</p>
          )}

          {/* Camera Settings */}
          {image.metadata?.settings && (
            <p className="text-xs text-white/80">{image.metadata.settings}</p>
          )}

          {/* View Icon */}
          <div className="mt-2 flex items-center text-xs text-white/90">
            <svg
              className="mr-1 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Click to view full size
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton for GalleryCard
 */
export function GalleryCardSkeleton({ aspectRatio = 1.5 }: { aspectRatio?: number }) {
  return (
    <div className="overflow-hidden rounded-lg bg-neutral-100 shadow-sm dark:bg-neutral-900">
      <div
        className="animate-pulse bg-neutral-200 dark:bg-neutral-800"
        style={{ aspectRatio: `${aspectRatio}` }}
      />
    </div>
  );
}
