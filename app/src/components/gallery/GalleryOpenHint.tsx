'use client';

/**
 * One-time hint shown the first time a visitor opens any project page
 * (/gallery/[slug]): a small, auto-dismissing pill telling them they can open
 * an image full-screen in the lightbox. Shown once ever per device
 * (localStorage `vflics:gallery-open-hint`), on both mobile and desktop, with
 * device-aware copy (Tap vs Click). Dismisses on tap, on a ~6s timeout, or when
 * the lightbox opens. Honors prefers-reduced-motion.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const HINT_KEY = 'vflics:gallery-open-hint';
const EASE = [0.16, 1, 0.3, 1] as const;

export function GalleryOpenHint({ dismissed = false }: { dismissed?: boolean }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      return; // storage blocked → skip the hint rather than nag every visit
    }
    setCoarse(window.matchMedia?.('(pointer: coarse)').matches ?? false);
    setShow(true);
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // Hide the moment the lightbox opens (the user clearly found the gesture).
  useEffect(() => {
    if (dismissed) setShow(false);
  }, [dismissed]);

  const verb = coarse ? 'Tap' : 'Click';

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          key="gallery-open-hint"
          onClick={() => setShow(false)}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
          aria-label="Dismiss hint"
          className="fixed bottom-[clamp(20px,4vw,32px)] left-1/2 z-40 -translate-x-1/2 cursor-pointer rounded-full bg-[var(--ink)] px-5 py-3 shadow-[0_14px_44px_rgba(0,0,0,0.28)]"
          style={{ maxWidth: 'calc(100vw - 40px)' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--cream)]">
            {verb} any image to view it full-screen
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
