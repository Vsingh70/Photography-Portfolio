/**
 * GalleryIndex — editorial "contents page".
 *
 * A magazine index of the work: an "Index" masthead, then hairline-separated
 * rows (text left, cover right; cover leads on mobile). Covers carry the slow
 * hover zoom; rows reveal on scroll. Replaces the old cover-card grid.
 */

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import type { WorkEntry } from '@/lib/projects';

const EASE = [0.16, 1, 0.3, 1] as const;

export function GalleryIndex({ work }: { work: WorkEntry[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="px-5 pb-[clamp(70px,10vw,130px)] sm:px-8 md:px-12 lg:px-16 xl:px-24">
      {/* Masthead */}
      <header className="flex flex-wrap items-end justify-between gap-5 pb-[clamp(30px,5vw,56px)] pt-[clamp(96px,12vw,150px)]">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-accent">
            Selected Work
          </div>
          <h1 className="mt-4 font-display font-light italic leading-[0.94] tracking-[-0.01em] text-ink [font-size:clamp(52px,9vw,116px)]">
            Index
          </h1>
        </div>
        <div className="meta text-right text-[10.5px] leading-[2]">
          {work.length} {work.length === 1 ? 'project' : 'projects'}
          <br />
          2026 — Editorial
        </div>
      </header>

      <main>
        {work.map((entry, i) => (
          <motion.div
            key={entry.slug}
            initial={reduce || i === 0 ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12% 0px' }}
            transition={{ duration: 0.85, ease: EASE }}
            className="border-t border-hair"
          >
            <Link
              href={`/gallery/${entry.slug}`}
              className="group grid grid-cols-1 items-center gap-6 py-[clamp(34px,5vw,64px)] md:grid-cols-2 md:gap-[clamp(24px,6vw,80px)]"
            >
              <div className="order-2 md:order-1">
                <div className="flex items-baseline gap-4">
                  <span className="meta text-[12px]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="meta text-[10px]">{entry.category}</span>
                </div>
                <h2 className="mt-4 font-display font-light leading-none tracking-[-0.015em] text-ink [font-size:clamp(40px,6.5vw,86px)]">
                  {entry.title}
                </h2>
                <div className="mt-5 meta text-[10.5px]">{entry.count} frames</div>
                <p className="mt-5 max-w-[40ch] text-[17px] leading-[1.65] text-ink-soft [text-wrap:pretty]">
                  {entry.blurb}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 border-b border-muted pb-1.5 font-display text-[13px] uppercase tracking-[0.18em] text-ink-soft">
                  View project
                  <span
                    aria-hidden
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </div>

              <div className="relative order-1 aspect-[4/5] w-full overflow-hidden bg-paper-2 md:order-2">
                <motion.div
                  className="absolute inset-0"
                  initial={false}
                  whileHover={reduce ? undefined : { scale: 1.06 }}
                  transition={{ duration: 0.85, ease: EASE }}
                >
                  <Image
                    src={entry.coverPath}
                    alt={`${entry.title} — cover`}
                    fill
                    priority={i < 2}
                    placeholder={entry.blurDataURL ? 'blur' : 'empty'}
                    blurDataURL={entry.blurDataURL}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </motion.div>
              </div>
            </Link>
          </motion.div>
        ))}
      </main>
    </div>
  );
}
