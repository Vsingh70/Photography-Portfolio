/**
 * GalleryCoverCard — Editorial Plate cover.
 *
 * Photo + dark translucent overlay + centered italic title. No rounded
 * corners. Hover deepens overlay, scales image and title slightly.
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
  const thumbnail = coverThumbnails.find((t) => t.categorySlug === cover.slug);
  const blurDataURL = thumbnail?.blurDataURL;

  return (
    <Link href={`/gallery/${cover.slug}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          delay: index * 0.05,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="group relative aspect-[3/4] cursor-pointer overflow-hidden"
      >
        <Image
          src={cover.imageUrl}
          alt={cover.title}
          width={cover.width}
          height={cover.height}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          priority={index < 3}
          placeholder={blurDataURL ? 'blur' : 'empty'}
          blurDataURL={blurDataURL}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        />

        <div className="absolute inset-0 bg-black/40 transition-colors duration-500 group-hover:bg-black/50" />

        <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
          <h2
            className="font-display font-light italic text-[#f5f3ee] text-4xl leading-none tracking-[-0.015em] transition-transform duration-300 group-hover:scale-[1.04] sm:text-5xl md:text-5xl lg:text-6xl"
            style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {cover.title}
          </h2>
        </div>
      </motion.div>
    </Link>
  );
}
