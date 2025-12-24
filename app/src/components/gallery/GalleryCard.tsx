/**
 * GalleryCard Component
 *
 * Individual image card with Next.js Image optimization, hover effects, and metadata overlay
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { GalleryImage } from '@/types/image';

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

  // Preload full-size image on hover for instant lightbox display
  const handleMouseEnter = () => {
    if (image.src && image.src !== image.thumbnail) {
      const img = new window.Image();
      img.src = image.src;
    }
  };

  return (
    <div
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
        {!hasError ? (
          <Image
            src={image.thumbnail || image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes={sizes}
            priority={priority}
            className={`
              h-auto w-full object-cover transition-all duration-500
              ${isLoaded ? 'scale-100 blur-0' : 'scale-105 blur-sm'}
              ${onClick ? 'cursor-pointer group-hover:scale-105' : ''}
            `}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            quality={90}
          />
        ) : (
          <div className="flex h-64 items-center justify-center bg-neutral-200 dark:bg-neutral-800">
            <p className="text-sm text-neutral-500">Failed to load image</p>
          </div>
        )}

        {/* Loading state */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
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
