/**
 * HeroContent — Kinetic Masthead
 *
 * Single self-contained hero that handles the full letter cascade, tagline,
 * and pill CTA. Replaces the old AnimatedHero + HeroContent split.
 *
 * Timing:
 *   0.2s  "The Portfolio of" caption fades
 *   0.2s+ VIRAJ SINGH letters cascade in (0.05s stagger)
 *   0.9s  divider rule fades
 *   1.1s  tagline rises
 *   2.0s  fires onAnimationComplete (navbar can show)
 *   2.4s  pill CTA rises
 */

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface HeroContentProps {
  onNavbarReady?: () => void;
  skipAnimation?: boolean;
}

const LETTERS = 'VIRAJ SINGH'.split('');
const LETTER_STAGGER = 0.05;
const LETTER_BASE_DELAY = 0.2;
const NAVBAR_READY_AT = 2000;
const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

export function HeroContent({ onNavbarReady, skipAnimation = false }: HeroContentProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const animate = !skipAnimation && !prefersReducedMotion;

  useEffect(() => {
    if (!animate) {
      onNavbarReady?.();
      return;
    }
    const t = setTimeout(() => onNavbarReady?.(), NAVBAR_READY_AT);
    return () => clearTimeout(t);
  }, [animate, onNavbarReady]);

  const initial = (state: Record<string, number | string>) => (animate ? state : false);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <motion.span
        initial={initial({ opacity: 0 })}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-primary-700 opacity-60 dark:text-primary-400 md:mb-6 md:text-xs"
      >
        The Portfolio of
      </motion.span>

      <h1 className="flex flex-wrap justify-center gap-x-[2px] font-display text-5xl font-light italic leading-[0.95] tracking-[-0.015em] text-primary-900 dark:text-primary-100 md:text-7xl lg:text-8xl xl:text-[7rem]">
        {LETTERS.map((letter, i) => (
          <motion.span
            key={i}
            initial={initial({ opacity: 0, y: '0.3em' })}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: LETTER_BASE_DELAY + i * LETTER_STAGGER,
              ease: EASE_OUT,
            }}
            className="inline-block"
            style={{ minWidth: letter === ' ' ? '0.35em' : undefined }}
          >
            {letter === ' ' ? ' ' : letter}
          </motion.span>
        ))}
      </h1>

      <motion.div
        initial={initial({ opacity: 0 })}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1, delay: 0.9, ease: EASE_OUT }}
        className="my-5 h-px w-16 bg-primary-900 dark:bg-primary-100 md:my-7 md:w-20"
      />

      <motion.p
        initial={initial({ opacity: 0, y: 12 })}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.1, ease: EASE_OUT }}
        className="max-w-[260px] font-display text-base leading-[1.45] text-primary-700 dark:text-primary-300 md:max-w-md md:text-xl lg:text-2xl"
      >
        A multidisciplinary photographer<br />
        specializing in portraits.
      </motion.p>

      <motion.div
        initial={initial({ opacity: 0, y: 12 })}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 2.4, ease: EASE_OUT }}
        className="mt-7 flex flex-col items-center gap-3 md:mt-10"
      >
        <Link
          href="/gallery"
          prefetch
          data-no-skip
          className="group inline-flex items-center gap-3 rounded-full border border-primary-900 px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] text-primary-900 transition-colors duration-300 hover:bg-primary-900 hover:text-white dark:border-primary-100 dark:text-primary-100 dark:hover:bg-primary-100 dark:hover:text-primary-900 md:px-9 md:py-4 md:text-[13px]"
        >
          View The Gallery
          <span
            aria-hidden
            className="inline-block motion-safe:animate-[arrow-nudge_1.6s_ease-in-out_infinite] transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary-700 opacity-50 dark:text-primary-400 md:text-[11px]">
          05 chapters · portraits, editorial &amp; more
        </span>
      </motion.div>
    </section>
  );
}
