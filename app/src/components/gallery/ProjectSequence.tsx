/**
 * ProjectSequence — editorial photo-essay layout.
 *
 * Replaces the masonry grid with the design's project "sequence": a centered
 * column with a wide lead frame, then a rhythm of single frames and
 * side-by-side pairs, each with a quiet figcaption. Pairs collapse to one
 * column on mobile; every frame insets from the window edge.
 *
 * Motion (Framer Motion): each row reveals on scroll with a fade + 0.985
 * scale-in (the brief's signature), and frames carry a slow 1.2s hover zoom.
 * All of it collapses to static under prefers-reduced-motion. Rows render
 * incrementally so large galleries stay light (few DOM nodes / observers).
 */

'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { GalleryImage, ImageVariants } from '@/types/image';
import { useInfiniteScroll } from '@/hooks/useLazyLoad';

const EASE = [0.16, 1, 0.3, 1] as const;

type RowType = 'wide' | 'single' | 'pair';
interface Row {
  type: RowType;
  items: number[]; // global indices into the images array
}

// Magazine cadence: a wide lead, then a repeating single/pair rhythm.
function buildRows(n: number): Row[] {
  const rows: Row[] = [];
  if (n <= 0) return rows;
  rows.push({ type: 'wide', items: [0] });
  let i = 1;
  const cycle: RowType[] = ['single', 'pair', 'single', 'single', 'pair'];
  let c = 0;
  while (i < n) {
    const t = cycle[c % cycle.length];
    if (t === 'pair' && i + 1 < n) {
      rows.push({ type: 'pair', items: [i, i + 1] });
      i += 2;
    } else {
      rows.push({ type: 'single', items: [i] });
      i += 1;
    }
    c++;
  }
  return rows;
}

function srcset(v: ImageVariants | undefined): string | undefined {
  if (!v) return undefined;
  return `${v.sm} 320w, ${v.md} 640w, ${v.lg} 1280w, ${v.xl} 2400w`;
}

const SIZES: Record<RowType, string> = {
  wide: '(max-width: 680px) calc(100vw - 40px), min(1080px, 92vw)',
  single: '(max-width: 680px) calc(100vw - 40px), 760px',
  pair: '(max-width: 680px) calc(100vw - 40px), min(540px, 46vw)',
};

function SequenceImage({
  image,
  index,
  rowType,
  onOpen,
  priority,
  reduce,
}: {
  image: GalleryImage;
  index: number;
  rowType: RowType;
  onOpen: (i: number) => void;
  priority: boolean;
  reduce: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  const aspectRatio =
    image.width && image.height ? `${image.width} / ${image.height}` : '4 / 5';

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`Open ${image.title || image.alt || 'image'} in viewer`}
      className="group relative block w-full cursor-pointer overflow-hidden bg-paper-2"
      style={{ aspectRatio }}
    >
      {image.blurDataURL && (
        <div
          aria-hidden
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{
            backgroundImage: `url("${image.blurDataURL}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(18px) saturate(1.05)',
            transform: 'scale(1.08)',
            opacity: loaded ? 0 : 1,
            pointerEvents: 'none',
          }}
        />
      )}
      <motion.div
        className="absolute inset-0"
        initial={false}
        whileHover={reduce ? undefined : { scale: 1.045 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <picture>
          {image.avif && (
            <source type="image/avif" srcSet={srcset(image.avif)} sizes={SIZES[rowType]} />
          )}
          {image.webp && (
            <source type="image/webp" srcSet={srcset(image.webp)} sizes={SIZES[rowType]} />
          )}
          <img
            ref={ref}
            src={image.webp?.lg || image.src}
            alt={image.alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease-out' }}
          />
        </picture>
      </motion.div>
    </button>
  );
}

interface ProjectSequenceProps {
  images: GalleryImage[];
  seriesLabel?: string;
  onOpen: (index: number) => void;
}

export function ProjectSequence({ images, seriesLabel = '', onOpen }: ProjectSequenceProps) {
  const reduce = useReducedMotion();
  const rows = useMemo(() => buildRows(images.length), [images.length]);

  const [visibleRows, setVisibleRows] = useState(() => Math.min(rows.length, 7));
  const loadMore = useCallback(
    () => setVisibleRows((v) => Math.min(v + 5, rows.length)),
    [rows.length]
  );
  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: visibleRows < rows.length,
  });

  const exifOf = (img: GalleryImage) =>
    img.metadata?.settings || img.metadata?.lens || '';

  return (
    <div className="px-5 pb-[clamp(40px,7vw,90px)] pt-[clamp(8px,3vw,32px)] sm:px-6">
      {rows.slice(0, visibleRows).map((row, ri) => {
        const lead = images[row.items[0]];
        const widthClass =
          row.type === 'wide'
            ? 'max-w-[1080px]'
            : row.type === 'pair'
              ? 'max-w-[1080px] grid grid-cols-1 gap-[clamp(14px,2.5vw,30px)] sm:grid-cols-2'
              : 'max-w-[760px]';

        return (
          <motion.figure
            key={`${row.type}-${row.items[0]}`}
            // Lead frame renders visible immediately — it's the LCP element.
            initial={reduce || ri === 0 ? false : { opacity: 0, y: 24, scale: 0.985 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.9, ease: EASE }}
            className={`mx-auto mb-[clamp(40px,7vw,96px)] w-full ${widthClass}`}
          >
            {row.items.map((gi) => (
              <SequenceImage
                key={images[gi].id}
                image={images[gi]}
                index={gi}
                rowType={row.type}
                onOpen={onOpen}
                priority={ri === 0}
                reduce={!!reduce}
              />
            ))}

            {row.type !== 'pair' && (
              <figcaption className="meta mt-3.5 flex justify-between text-[10px]">
                <span>
                  {seriesLabel ? `${seriesLabel} — ` : ''}
                  {String(row.items[0] + 1).padStart(2, '0')}
                </span>
                {exifOf(lead) && <span>{exifOf(lead)}</span>}
              </figcaption>
            )}
          </motion.figure>
        );
      })}

      {visibleRows < rows.length && <div ref={sentinelRef} className="h-2" aria-hidden />}
    </div>
  );
}
