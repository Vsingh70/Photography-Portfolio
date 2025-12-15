/**
 * HeroContent Component
 *
 * Displays post-animation content:
 * - 2-sentence paragraph (Lora font)
 * - Logo positioned to the right (desktop) or below (mobile)
 * - "View Portfolio" CTA button
 *
 * Fades in smoothly after animation completes.
 */

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui';

export function HeroContent() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      className="mx-auto mt-16 max-w-5xl px-4"
    >
      {/* Desktop layout: paragraph + logo side by side */}
      <div className="hidden items-start gap-12 md:flex">
        <div className="flex-1">
          <p className="font-serif text-xl leading-relaxed text-primary-700">
            Capturing timeless moments through the lens of creativity and passion. Every
            frame tells a story worth preserving.
          </p>
          <Link href="/gallery">
            <Button size="lg" className="mt-8">
              View Portfolio
            </Button>
          </Link>
        </div>

        {/* Logo on the right */}
        <div className="h-40 w-40 flex-shrink-0">
          <Image
            src="/vs logo black.svg"
            alt="Viraj Singh Photography Logo"
            width={160}
            height={160}
            className="h-full w-full"
            priority
          />
        </div>
      </div>

      {/* Mobile layout: stacked */}
      <div className="flex flex-col items-center gap-8 md:hidden">
        <p className="text-center font-serif text-base leading-relaxed text-primary-700">
          Capturing timeless moments through the lens of creativity and passion. Every
          frame tells a story worth preserving.
        </p>

        {/* Logo centered */}
        <Image
          src="/vs logo black.svg"
          alt="Viraj Singh Photography Logo"
          width={120}
          height={120}
          priority
        />

        {/* Full-width CTA button */}
        <Link href="/gallery" className="w-full">
          <Button size="lg" className="w-full">
            View Portfolio
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
