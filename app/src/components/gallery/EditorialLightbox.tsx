/**
 * EditorialLightbox — full-screen viewer with Minimal + Spread modes.
 *
 * Performance pipeline:
 *   1. blurDataURL paints as a CSS background — first visible frame < 16ms
 *   2. <img> uses fetchpriority="high" + decoding="async"
 *   3. img.decode() awaits before fading in — jank-free reveal
 *   4. ±2 neighbors preloaded via <link rel="preload"> on requestIdleCallback
 *   5. Chrome (top bar, panel, ticks) is React.memo'd — index changes only
 *      re-render the image stage
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
import type { GalleryImage } from '@/types/image';

interface EditorialLightboxProps {
  images: GalleryImage[];
  index: number;
  open: boolean;
  onChange: (index: number) => void;
  onClose: () => void;
}

type Mode = 'minimal' | 'spread';

const LB_MODE_KEY = 'vflics:lightbox-mode';
const PANEL_DESKTOP_W = 360;
const PANEL_MOBILE_H = 220;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function formatHumanDate(raw: string | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function useStoredMode(): [Mode, (m: Mode) => void] {
  const [mode, setModeState] = useState<Mode>('minimal');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LB_MODE_KEY);
      if (stored === 'minimal' || stored === 'spread') setModeState(stored);
    } catch {}
  }, []);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try {
      localStorage.setItem(LB_MODE_KEY, next);
    } catch {}
  }, []);

  return [mode, setMode];
}

function useNeighborPreload(images: GalleryImage[], index: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const total = images.length;
    if (total <= 1) return;

    const targets = [
      images[(index + 1) % total],
      images[(index - 1 + total) % total],
      images[(index + 2) % total],
      images[(index - 2 + total) % total],
    ];

    const links: HTMLLinkElement[] = [];
    const win = window as typeof window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = win.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 80));
    const cancel = win.cancelIdleCallback ?? clearTimeout;

    const id = schedule(() => {
      const seen = new Set<string>();
      targets.forEach((img) => {
        if (!img) return;
        // Prefer the lg webp variant — most lightbox views display this tier.
        const href = img.webp?.lg || img.src;
        if (seen.has(href)) return;
        seen.add(href);
        if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = href;
        link.setAttribute('fetchpriority', 'low');
        document.head.appendChild(link);
        links.push(link);
      });
    });

    return () => {
      try {
        cancel(id as number);
      } catch {}
      links.forEach((l) => l.remove());
    };
  }, [images, index, enabled]);
}

const Caption = memo(function Caption({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.22em] ${className}`}
      style={style}
    >
      {children}
    </span>
  );
});

const ModeToggle = memo(function ModeToggle({
  mode,
  onChange,
  isDesktop,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  isDesktop: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Lightbox view mode"
      className="inline-flex items-center gap-0.5 rounded-full border border-white/20 bg-black/40 p-0.5 backdrop-blur-md"
    >
      {(['minimal', 'spread'] as const).map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={`
              rounded-full font-mono uppercase tracking-[0.22em] transition-colors duration-300
              ${active ? 'bg-[#f5f3ee] text-[#0a0a0a]' : 'bg-transparent text-white/75'}
              ${isDesktop ? 'px-3.5 py-1.5 text-[10px]' : 'px-2.5 py-1 text-[9px]'}
            `}
          >
            {m === 'minimal' ? 'Minimal' : 'Spread'}
          </button>
        );
      })}
    </div>
  );
});

const TICK_WIDTH = 20;
const TICK_GAP = 6;

const ProgressTicks = memo(function ProgressTicks({
  total,
  index,
  onChange,
  isDesktop,
  visible,
}: {
  total: number;
  index: number;
  onChange: (i: number) => void;
  isDesktop: boolean;
  visible: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(total);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (!w) return;
      const fit = Math.max(1, Math.floor((w + TICK_GAP) / (TICK_WIDTH + TICK_GAP)));
      setCapacity(Math.min(total, fit));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [total]);

  // Page-style sliding window: the active bar moves through the row, and the
  // row only advances once a full page has been crossed. Wraps circularly.
  const slots = useMemo<number[]>(() => {
    if (total === 0) return [];
    const n = Math.min(capacity, total);
    const page = Math.floor(index / n);
    const start = (page * n) % total;
    return Array.from({ length: n }, (_, i) => (start + i) % total);
  }, [capacity, index, total]);

  return (
    <div
      className="absolute z-10"
      style={{
        bottom: isDesktop ? 36 : 24,
        right: isDesktop ? 32 : 22,
        maxWidth: isDesktop ? 'calc(100% - 380px)' : 'calc(100vw - 44px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        ref={wrapRef}
        className="flex items-center justify-end"
        style={{ gap: TICK_GAP, minWidth: TICK_WIDTH }}
      >
        {slots.map((orig, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(orig)}
            aria-label={`Go to image ${orig + 1}`}
            aria-current={orig === index ? 'true' : undefined}
            className="border-none p-0 transition-colors"
            style={{
              width: TICK_WIDTH,
              height: 2,
              background: orig === index ? '#f5f3ee' : 'rgba(245,243,238,0.25)',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          />
        ))}
      </div>
    </div>
  );
});

const ImageStage = memo(
  function ImageStage({
    image,
    isDesktop,
    mode,
  }: {
    image: GalleryImage;
    isDesktop: boolean;
    mode: Mode;
  }) {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
      setLoaded(false);
      const el = imgRef.current;
      if (!el) return;
      if (el.complete && el.naturalWidth > 0) {
        if (el.decode) {
          el.decode().then(() => setLoaded(true)).catch(() => setLoaded(true));
        } else {
          setLoaded(true);
        }
      }
    }, [image.id]);

    const onLoad = useCallback(() => {
      const el = imgRef.current;
      if (el?.decode) {
        el.decode().then(() => setLoaded(true)).catch(() => setLoaded(true));
      } else {
        setLoaded(true);
      }
    }, []);

    return (
      <div
        style={{
          position: 'absolute',
          top: isDesktop ? 64 : 150,
          left: isDesktop ? 100 : 24,
          right:
            mode === 'spread' && isDesktop
              ? PANEL_DESKTOP_W + 32
              : isDesktop
              ? 100
              : 24,
          bottom:
            mode === 'spread' && !isDesktop
              ? PANEL_MOBILE_H + 12
              : isDesktop
              ? 64
              : 130,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: `right 0.55s ${EASE}, bottom 0.55s ${EASE}`,
        }}
      >
        <div
          key={image.id}
          className="animate-[lb-image-in_0.45s_cubic-bezier(0.16,1,0.3,1)]"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
          }}
        >
          {image.blurDataURL && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("${image.blurDataURL}")`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: 'blur(24px) saturate(1.05)',
                transform: 'scale(1.05)',
                opacity: loaded ? 0 : 1,
                transition: 'opacity 0.35s ease-out',
                pointerEvents: 'none',
              }}
            />
          )}
          <picture>
            {image.avif && (
              <source
                type="image/avif"
                srcSet={`${image.avif.lg} 1280w, ${image.avif.xl} 2400w`}
                sizes="100vw"
              />
            )}
            {image.webp && (
              <source
                type="image/webp"
                srcSet={`${image.webp.lg} 1280w, ${image.webp.xl} 2400w`}
                sizes="100vw"
              />
            )}
            <img
              ref={imgRef}
              src={image.webp?.xl || image.src}
              alt={image.alt}
              onLoad={onLoad}
              fetchPriority="high"
              decoding="async"
              loading="eager"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                opacity: loaded ? 1 : 0,
                transition: 'opacity 0.35s ease-out',
                zIndex: 1,
              }}
            />
          </picture>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.image.id === next.image.id &&
    prev.mode === next.mode &&
    prev.isDesktop === next.isDesktop
);

export function EditorialLightbox({
  images,
  index,
  open,
  onChange,
  onClose,
}: EditorialLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useStoredMode();
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('overflow-hidden');
    return () => document.documentElement.classList.remove('overflow-hidden');
  }, [open]);

  const total = images.length;
  const prev = useCallback(
    () => onChange((index - 1 + total) % total),
    [index, total, onChange]
  );
  const next = useCallback(
    () => onChange((index + 1) % total),
    [index, total, onChange]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, prev, next, onClose]);

  useNeighborPreload(images, index, open);

  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
    startX.current = null;
  };

  const img = images[index];
  const humanDate = useMemo(() => formatHumanDate(img?.metadata?.date), [img]);
  const meta = useMemo<Array<[string, string]>>(
    () =>
      img
        ? ([
            ['Series', img.category],
            ['Made', humanDate],
            ['Where', img.metadata?.location],
            ['Camera', img.metadata?.camera],
            ['Lens', img.metadata?.lens],
            ['Settings', img.metadata?.settings],
          ].filter(([, v]) => !!v) as Array<[string, string]>)
        : [],
    [img]
  );

  if (!mounted || !open || !img) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Image ${index + 1} of ${total}: ${img.title}`}
      data-mode={mode}
      className="fixed inset-0 z-[100] overflow-hidden bg-[#0a0a0a] text-[#f5f3ee] animate-[lb-fade_0.35s_ease-out_both]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <ImageStage image={img} mode={mode} isDesktop={isDesktop} />

      <div
        className="absolute left-4 right-4 z-20 flex items-center justify-between gap-4"
        style={{ top: isDesktop ? 16 : 56 }}
      >
        <Caption style={{ color: 'rgba(245,243,238,0.85)' }}>vflics — Gallery</Caption>
        <div className="flex items-center gap-4">
          {isDesktop && <ModeToggle mode={mode} onChange={setMode} isDesktop />}
          <Caption className="text-right" style={{ minWidth: 56 }}>
            <span className="text-[#f5f3ee]">{String(index + 1).padStart(2, '0')}</span>
            <span className="opacity-40"> / {String(total).padStart(2, '0')}</span>
          </Caption>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white"
          >
            {isDesktop && <span className="opacity-70">Close</span>}
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/35 text-sm leading-none">
              ×
            </span>
          </button>
        </div>
      </div>

      {!isDesktop && (
        <div className="absolute left-0 right-0 top-[100px] z-20 flex justify-center">
          <ModeToggle mode={mode} onChange={setMode} isDesktop={false} />
        </div>
      )}

      <div
        className="absolute z-10"
        style={{
          bottom: isDesktop ? 28 : 56,
          left: isDesktop ? 32 : 22,
          right: isDesktop ? undefined : 22,
          maxWidth: isDesktop ? 'calc(100% - 380px)' : undefined,
          opacity: mode === 'minimal' ? 1 : 0,
          transform: mode === 'minimal' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          pointerEvents: mode === 'minimal' ? 'auto' : 'none',
        }}
      >
        <Caption className="opacity-60">
          {img.category}
          {humanDate ? ` · ${humanDate}` : ''}
        </Caption>
        <h2
          className="font-display mt-1.5 italic font-light leading-tight tracking-[-0.01em] text-[#f5f3ee]"
          style={{ fontSize: isDesktop ? 32 : 24 }}
        >
          {img.title}
        </h2>
      </div>

      <ProgressTicks
        total={total}
        index={index}
        onChange={onChange}
        isDesktop={isDesktop}
        visible={mode === 'minimal'}
      />

      <aside
        aria-hidden={mode !== 'spread'}
        className="absolute z-[15] flex flex-col gap-3.5 overflow-auto"
        style={{
          ...(isDesktop
            ? {
                top: 56,
                bottom: 16,
                right: 16,
                width: PANEL_DESKTOP_W,
                paddingLeft: 32,
                paddingTop: 8,
                borderLeft: '1px solid rgba(245,243,238,0.08)',
                transform:
                  mode === 'spread' ? 'translateX(0)' : 'translateX(calc(100% + 16px))',
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                height: PANEL_MOBILE_H,
                padding: '20px 22px 22px',
                borderTop: '1px solid rgba(245,243,238,0.08)',
                background: '#0a0a0a',
                transform: mode === 'spread' ? 'translateY(0)' : 'translateY(100%)',
              }),
          opacity: mode === 'spread' ? 1 : 0,
          transition: `transform 0.55s ${EASE}, opacity 0.4s ease`,
        }}
      >
        <Caption>{img.category}</Caption>
        <h2
          className="font-display italic font-light leading-tight tracking-[-0.015em] text-[#f5f3ee] m-0"
          style={{ fontSize: isDesktop ? 32 : 24 }}
        >
          {img.title}
        </h2>
        <div className="h-px bg-white/10" />
        <dl
          className="m-0 p-0"
          style={{
            display: isDesktop ? 'block' : 'grid',
            gridTemplateColumns: isDesktop ? undefined : '1fr 1fr',
            gap: isDesktop ? 0 : '0 18px',
          }}
        >
          {meta.map(([k, v], i, arr) => (
            <div
              key={k}
              className="grid items-baseline"
              style={{
                gridTemplateColumns: isDesktop ? '80px 1fr' : '1fr',
                gap: isDesktop ? 12 : 2,
                padding: isDesktop ? '9px 0' : '6px 0',
                borderBottom:
                  isDesktop && i < arr.length - 1
                    ? '1px solid rgba(245,243,238,0.08)'
                    : 'none',
              }}
            >
              <dt>
                <Caption className="opacity-60" style={{ fontSize: 9 }}>
                  {k}
                </Caption>
              </dt>
              <dd
                className="font-display italic m-0 leading-snug text-[#f5f3ee]"
                style={{ fontSize: isDesktop ? 15 : 13 }}
              >
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </aside>

      <button
        type="button"
        onClick={prev}
        aria-label="Previous image"
        className="absolute top-1/2 left-6 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 font-mono text-lg text-white backdrop-blur-md transition-all duration-500 hover:border-white/50 hover:bg-white/10 md:flex"
        style={{ transitionTimingFunction: EASE }}
      >
        ←
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next image"
        className="absolute top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 font-mono text-lg text-white backdrop-blur-md transition-all duration-500 hover:border-white/50 hover:bg-white/10 md:flex"
        style={{
          right: mode === 'spread' ? PANEL_DESKTOP_W + 56 : 24,
          transitionTimingFunction: EASE,
        }}
      >
        →
      </button>
    </div>,
    document.body
  );
}
