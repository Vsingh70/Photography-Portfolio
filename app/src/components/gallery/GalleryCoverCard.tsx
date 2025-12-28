/**
 * Gallery Cover Card Component
 *
 * Displays an individual cover image with title for the main gallery page
 * OPTIMIZED: Uses static pre-generated WebP thumbnails for instant loading
 */

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import type { GalleryCover } from '@/types/gallery';
import coverThumbnails from '@/generated/cover-thumbnails.json';

interface GalleryCoverCardProps {
  cover: GalleryCover;
  index: number;
}

export function GalleryCoverCard({ cover, index }: GalleryCoverCardProps) {
  // Get blur placeholder from pre-generated data
  const thumbnail = coverThumbnails.find((t) => t.categorySlug === cover.slug);
  const blurDataURL = thumbnail?.blurDataURL;

  return (
    <Link href={`/gallery/${cover.slug}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          delay: index * 0.05,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="group cursor-pointer"
      >
        {/* Image Container with Overlay and Centered Text */}
        <div className="relative overflow-hidden rounded-lg">
          <Image
            src={cover.imageUrl}
            alt={cover.title}
            width={cover.width}
            height={cover.height}
            className="h-auto w-full object-cover transition-all duration-500 group-hover:scale-105"
            priority
            placeholder={blurDataURL ? 'blur' : 'empty'}
            blurDataURL={blurDataURL}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />

          {/* Dark Translucent Overlay */}
          <div className="absolute inset-0 bg-black/40 transition-all duration-500 group-hover:bg-black/50" />

          {/* Centered Title */}
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="font-display font-light text-2xl text-white transition-all duration-300 group-hover:scale-105 md:text-3xl lg:text-4xl">
              {cover.title}
            </h2>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
