/**
 * HeroContent Component
 *
 * Displays introductory paragraph with logo after AnimatedHero fades out.
 * - Lorem ipsum paragraph using Canela Light font
 * - Desktop: paragraph left, logo right
 * - Mobile: logo top, paragraph below
 * - Fades in sync with Navbar
 * - Theme-aware text colors
 * - Large text and logo sizes, positioned higher without scrollbar
 */

'use client';

import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function HeroContent() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="flex min-h-screen flex-col items-center justify-start px-4 pt-32 sm:px-6 sm:pt-40 md:px-8 md:pt-48 lg:px-10"
    >
      <div className="flex flex-col items-center gap-20 sm:gap-16 md:flex-row md:items-center md:justify-between md:gap-12 lg:gap-16 xl:gap-24">
        {/* Paragraph - left on desktop, below logo on mobile */}
        <p className="order-2 max-w-3xl font-display font-light text-2xl leading-relaxed text-primary-900 dark:text-primary-100 sm:text-3xl md:order-1 md:text-left lg:text-4xl">
          Viraj <span className="font-thin italic">(/vur-ahj/)</span> is a transdisciplinary photographer with a specialization in portraits, capturing the raw emotions and untold stories behind every frame.
        </p>

        {/* Logo - right on desktop, top on mobile - smaller on mobile, larger on desktop */}
        <div className="order-1 flex-shrink-0 md:order-2">
          {!mounted ? (
            <div className="h-[160px] w-[160px] animate-pulse rounded bg-primary-200 dark:bg-primary-700 sm:h-[240px] sm:w-[240px] md:h-[380px] md:w-[380px] lg:h-[560px] lg:w-[560px]" />
          ) : (
            <Image
              src={resolvedTheme === 'dark' ? '/vs logo white.svg' : '/vs logo black.svg'}
              alt="Viraj Singh Photography"
              width={560}
              height={560}
              className="h-[160px] w-[160px] transition-opacity hover:opacity-80 sm:h-[240px] sm:w-[240px] md:h-[380px] md:w-[380px] lg:h-[560px] lg:w-[560px]"
              priority
            />
          )}
        </div>
      </div>

      {/* View Gallery Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="mt-12 sm:mt-16 md:mt-20"
      >
        <Link
          href="/gallery"
          className="group relative inline-block px-8 py-4 font-display font-thin italic text-2xl text-primary-900 transition-all hover:text-primary-700 hover:drop-shadow-lg dark:text-primary-100 dark:hover:text-primary-300 sm:text-3xl"
        >
          View Gallery
          <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary-900 transition-all duration-300 group-hover:w-full dark:bg-primary-100" />
        </Link>
      </motion.div>
    </motion.section>
  );
}
