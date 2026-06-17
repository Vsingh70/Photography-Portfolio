/**
 * HomeView — cinematic home.
 *
 * A full-bleed editorial hero (image + scrim + name) over which the navbar
 * rides transparent, then a "Selected Work" index of bodies of work. Motion
 * is restrained: the hero text rises once; each work row reveals on scroll;
 * covers carry a slow 1.2s zoom on hover. All of it collapses to static under
 * `prefers-reduced-motion`.
 */

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import type { WorkEntry, HeroCover } from '@/lib/projects';

const EASE = [0.16, 1, 0.3, 1] as const;

interface HomeViewProps {
  work: WorkEntry[];
  hero: HeroCover | null;
}

export function HomeView({ work, hero }: HomeViewProps) {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: EASE },
  });

  return (
    <>
      <Navbar overlay />

      <main>
        {/* ---- Cinematic hero ---- */}
        <section className="relative h-[100svh] min-h-[600px] overflow-hidden bg-[#0e0d0c]">
          {hero && (
            <>
              <Image
                src={hero.path}
                alt={hero.alt || 'Editorial portrait — Viraj Singh'}
                fill
                priority
                placeholder={hero.blurDataURL ? 'blur' : 'empty'}
                blurDataURL={hero.blurDataURL}
                sizes="100vw"
                className="object-cover opacity-[0.92]"
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,.38) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 54%, rgba(0,0,0,.74) 100%)',
                }}
              />
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 px-5 pb-[clamp(48px,8vw,84px)] text-[var(--cream)] sm:px-8 md:px-12 lg:px-16 xl:px-24">
            <motion.div
              {...rise(0.15)}
              className="font-mono text-[10px] uppercase tracking-[0.26em] text-[rgba(245,243,238,0.7)] md:text-[11px]"
            >
              Editorial photography — fashion · portraiture · brand
            </motion.div>
            <motion.h1
              {...rise(0.28)}
              className="mt-4 font-display font-light italic leading-[0.9] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(56px, 11vw, 150px)' }}
            >
              Viraj Singh
            </motion.h1>
            <motion.div {...rise(0.42)} className="mt-7">
              <Link
                href="/gallery"
                className="group inline-flex items-center gap-2.5 border-b border-[var(--cream)] pb-1.5 font-display text-[13px] uppercase tracking-[0.18em] text-[var(--cream)]"
              >
                View Work
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </motion.div>
          </div>

          <div
            aria-hidden
            className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[rgba(245,243,238,0.8)] motion-safe:animate-[vf-cue_2.4s_ease-in-out_infinite]"
          >
            <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
              <path
                d="M9 1v22M2 16l7 7 7-7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </section>

        {/* ---- Selected Work index ---- */}
        <section className="px-5 pb-[clamp(70px,10vw,130px)] pt-[clamp(56px,9vw,120px)] sm:px-8 md:px-12 lg:px-16 xl:px-24">
          <div className="mb-[clamp(34px,5vw,60px)] flex items-baseline justify-between border-t border-hair pt-7">
            <h2 className="font-display text-[clamp(22px,3vw,34px)] font-normal italic text-ink">
              Selected Work
            </h2>
            <span className="meta text-[10.5px]">
              {work.length} {work.length === 1 ? 'project' : 'projects'}
            </span>
          </div>

          <div className="flex flex-col gap-[clamp(46px,7vw,96px)]">
            {work.map((entry, i) => (
              <motion.div
                key={entry.slug}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-12% 0px' }}
                transition={{ duration: 0.85, ease: EASE }}
              >
                <Link
                  href={`/gallery/${entry.slug}`}
                  className="group grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-[clamp(20px,5vw,70px)]"
                >
                  <div className="relative order-first aspect-[3/4] w-full overflow-hidden bg-paper-2">
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
                        placeholder={entry.blurDataURL ? 'blur' : 'empty'}
                        blurDataURL={entry.blurDataURL}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </motion.div>
                  </div>

                  <div>
                    <span className="meta text-[11px]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-3.5 font-display font-light leading-[1.02] tracking-[-0.01em] text-ink [font-size:clamp(34px,5vw,62px)]">
                      {entry.title}
                    </h3>
                    <div className="mt-4 meta text-[10.5px]">
                      {entry.category} · {entry.count} frames
                    </div>
                    <p className="mt-5 max-w-[42ch] text-[16px] leading-[1.65] text-ink-soft [text-wrap:pretty]">
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
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
