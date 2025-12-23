/**
 * Gallery Cover Card Component
 *
 * Displays an individual cover image with title for the main gallery page
 */

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import type { GalleryCover } from '@/types/gallery';

interface GalleryCoverCardProps {
  cover: GalleryCover;
  index: number;
}

export function GalleryCoverCard({ cover, index }: GalleryCoverCardProps) {
  return (
    <Link href={`/gallery/${cover.slug}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.6,
          delay: index * 0.1,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="group cursor-pointer"
      >
        {/* Image Container */}
        <div className="relative overflow-hidden rounded-lg">
          <Image
            src={cover.imageUrl}
            alt={cover.title}
            width={cover.width}
            height={cover.height}
            className="h-auto w-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:opacity-90"
            priority
            quality={95}
          />
        </div>

        {/* Title */}
        <h2 className="mt-4 font-display font-light text-2xl text-primary-900 transition-colors group-hover:text-primary-700 dark:text-primary-100 dark:group-hover:text-primary-300 md:text-3xl">
          {cover.title}
        </h2>
      </motion.div>
    </Link>
  );
}
