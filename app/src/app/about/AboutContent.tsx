/**
 * AboutContent Component
 *
 * Client component for the about page with fade-in animations
 * - Matches HeroContent animation pattern
 * - Desktop: Text left, Image right
 * - Mobile: Title top, Image middle, Text bottom
 * - Uses Canela font for title and text
 * - Theme-aware styling
 */

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import type { GalleryImage } from '@/types/image';

interface AboutContentProps {
  image: GalleryImage | null;
}

export function AboutContent({ image }: AboutContentProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="px-4 pt-24 pb-16 sm:px-6 sm:pt-28 sm:pb-20 lg:px-8 lg:pt-32 lg:pb-24"
    >
      {/* Title - Centered */}
      <div className="mb-12 text-center sm:mb-16 md:mb-20">
        <h1 className="font-display font-light italic text-primary-900 dark:text-white text-4xl sm:text-5xl lg:text-6xl">
          About
        </h1>
      </div>

      {/* Content Container - Desktop: Text left, Image right | Mobile: Image then Text */}
      <div className="flex flex-col items-center gap-12 md:flex-row md:items-start md:justify-between md:gap-8 lg:gap-16">
        {/* Text Content - Left on desktop, bottom on mobile */}
        <div className="order-2 max-w-2xl md:order-1 md:flex-1">
          <p className="font-display font-light text-lg leading-relaxed text-primary-900 dark:text-primary-100 sm:text-xl lg:text-2xl">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>

        {/* Image - Right on desktop, middle on mobile */}
        {image && (
          <div className="order-1 w-full md:order-2 md:w-auto md:flex-1 md:max-w-xl">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
              <Image
                src={image.thumbnail}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                placeholder="blur"
                blurDataURL={image.blurDataURL}
              />
            </div>
          </div>
        )}

        {/* Fallback if no image */}
        {!image && (
          <div className="order-1 w-full md:order-2 md:w-auto md:flex-1 md:max-w-xl">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-primary-200 dark:bg-primary-800">
              <div className="flex h-full items-center justify-center">
                <p className="font-display text-primary-700 dark:text-primary-300">
                  Image not available
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
