/**
 * AnimatedHero Component
 *
 * Orchestrates the multi-phase text animation sequence with letter-by-letter effects:
 * VFLICS (hold 1.5s) → VIRAJ FLICS (letters fade in) → VIRAJ S (letters fade out) → VIRAJ SINGH (letters fade in)
 *
 * Uses framer-motion for smooth, premium animations.
 * Respects user's reduced-motion preference for accessibility.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HERO_ANIMATION_CONFIG } from '@/config/animation.config';

interface AnimatedHeroProps {
  /** Callback function triggered when animation completes */
  onComplete: () => void;
}

type AnimationPhase = 1 | 2 | 3 | 4 | 5;

export function AnimatedHero({ onComplete }: AnimatedHeroProps) {
  const [phase, setPhase] = useState<AnimationPhase>(1);

  // Check if user prefers reduced motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Memoize the onComplete callback to prevent re-renders
  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Orchestrate the animation sequence
  useEffect(() => {
    // If reduced motion is preferred or animation is disabled, skip to final state
    if (prefersReducedMotion || !HERO_ANIMATION_CONFIG.enabled) {
      setPhase(5);
      handleComplete();
      return;
    }

    const timers: NodeJS.Timeout[] = [];
    const { timings } = HERO_ANIMATION_CONFIG;

    // Phase 2: Start after initial display (hold VFLICS for 1.5s)
    timers.push(setTimeout(() => setPhase(2), timings.initial));

    // Phase 3: After transition1 + hold1
    timers.push(
      setTimeout(() => setPhase(3), timings.initial + timings.transition1 + timings.hold1)
    );

    // Phase 4: After transition2
    timers.push(
      setTimeout(
        () => setPhase(4),
        timings.initial + timings.transition1 + timings.hold1 + timings.transition2
      )
    );

    // Phase 5: After transition3 + finalHold
    timers.push(
      setTimeout(
        () => {
          setPhase(5);
          handleComplete();
        },
        timings.initial +
          timings.transition1 +
          timings.hold1 +
          timings.transition2 +
          timings.transition3 +
          timings.finalHold
      )
    );

    // Cleanup timers on unmount
    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion, handleComplete]);

  // If reduced motion or disabled, show static final state
  if (prefersReducedMotion || !HERO_ANIMATION_CONFIG.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="font-display font-light italic text-4xl text-primary-900 md:text-5xl lg:text-6xl">
          VIRAJ SINGH
        </h1>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden">
      <div className="text-center">
        {/* Phase-based rendering */}
        {phase === 1 && <Phase1 />}
        {phase === 2 && <Phase2 />}
        {phase === 3 && <Phase3 />}
        {phase === 4 && <Phase4 />}
        {phase === 5 && <Phase5 />}
      </div>
    </div>
  );
}

/**
 * Phase 1: Initial "VFLICS" display (holds for 1.5s)
 */
function Phase1() {
  return (
    <motion.h1
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: HERO_ANIMATION_CONFIG.easing.fadeIn }}
      className="font-display italic text-4xl text-primary-900 md:text-5xl lg:text-6xl"
      style={{ fontWeight: 300, fontVariationSettings: '"wght" 300' }}
    >
      VFLICS
    </motion.h1>
  );
}

/**
 * Phase 2: Transform to "VIRAJ FLICS"
 * "V" stays in place, "IRAJ " fades in letter-by-letter (opacity only), "FLICS" slides right
 */
function Phase2() {
  const { timings, easing } = HERO_ANIMATION_CONFIG;
  const irajLetters = ['I', 'R', 'A', 'J', ' '];

  return (
    <motion.h1 className="font-display italic text-4xl text-primary-900 md:text-5xl lg:text-6xl" style={{ fontWeight: 300, fontVariationSettings: '"wght" 300' }}>
      {/* V stays in place */}
      <span className="inline-block align-top">V</span>

      <span className="relative inline-block align-top">
        {irajLetters.map((letter, i) => (
          <motion.span
            key={`iraj-${i}`}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            transition={{
              opacity: {
                delay: (i * timings.letterStagger) / 1000,
                duration: 0.9,
                ease: "easeOut",
              },
              width: {
                delay: (i * timings.letterStagger) / 1000,
                duration: 0.6,
                ease: easing.slide,
              }
            }}
            className="inline-block overflow-hidden align-top whitespace-nowrap"
          >
            {letter === ' ' ? '\u00A0' : letter}
          </motion.span>
        ))}

        <span className="inline-block align-top">FLICS</span>
      </span>
    </motion.h1>
  );
}

/**
 * Phase 3: Transform to "VIRAJ S"
 * "FLIC" fades out letter-by-letter (C→I→L→F), "S" moves left
 */
function Phase3() {
  const { timings, easing } = HERO_ANIMATION_CONFIG;
  // Fade out in reverse order: C, I, L, F
  const flickLetters = [
    { letter: 'F', delay: 3 },
    { letter: 'L', delay: 2 },
    { letter: 'I', delay: 1 },
    { letter: 'C', delay: 0 },
  ];

  return (
    <motion.h1 className="font-display italic text-4xl text-primary-900 md:text-5xl lg:text-6xl" style={{ fontWeight: 300, fontVariationSettings: '"wght" 300' }}>
      <span className="inline-block align-top">VIRAJ</span>

      <span className="relative inline-block align-top">
        {/* Permanent space between VIRAJ and S */}
        <span className="inline-block align-top">{'\u00A0'}</span>

        {/* FLIC fades out letter-by-letter (C first, then I, L, F) with width collapse */}
        {flickLetters.map(({ letter, delay }, index) => (
          <motion.span
            key={`flic-${index}`}
            initial={{ opacity: 1, width: 'auto' }}
            animate={{ opacity: 0, width: 0 }}
            transition={{
              opacity: {
                delay: (delay * timings.letterStagger) / 1000,
                duration: 0.9,
                ease: easing.fadeOut,
              },
              width: {
                delay: (delay * timings.letterStagger) / 1000 + 0.5,
                duration: 0.6,
                ease: easing.slide,
              }
            }}
            className="inline-block overflow-hidden align-top whitespace-nowrap"
          >
            {letter === ' ' ? '\u00A0' : letter}
          </motion.span>
        ))}

        {/* S naturally moves left as FLIC collapses */}
        <span className="inline-block align-top">S</span>
      </span>
    </motion.h1>
  );
}

/**
 * Phase 4: Add "INGH" letter-by-letter to complete "VIRAJ SINGH"
 * Each letter (I, N, G, H) fades in one by one with width expansion
 */
function Phase4() {
  const { timings, easing } = HERO_ANIMATION_CONFIG;
  const letters = ['I', 'N', 'G', 'H'];

  return (
    <motion.h1 className="font-display italic text-4xl text-primary-900 md:text-5xl lg:text-6xl" style={{ fontWeight: 300, fontVariationSettings: '"wght" 300' }}>
      <span className="inline-block align-top">VIRAJ S</span>

      <span className="relative inline-block align-top">
        {/* INGH appears letter-by-letter with opacity fade-in and width expansion */}
        {letters.map((letter, i) => (
          <motion.span
            key={`ingh-${i}`}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            transition={{
              opacity: {
                delay: (i * timings.letterStagger) / 1000,
                duration: 0.9,
                ease: "easeOut",
              },
              width: {
                delay: (i * timings.letterStagger) / 1000,
                duration: 0.6,
                ease: easing.slide,
              }
            }}
            className="inline-block overflow-hidden align-top whitespace-nowrap"
          >
            {letter}
          </motion.span>
        ))}
      </span>
    </motion.h1>
  );
}

/**
 * Phase 5: Final "VIRAJ SINGH" state (holds before showing content)
 */
function Phase5() {
  return (
    <motion.h1
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      className="font-display italic text-4xl text-primary-900 md:text-5xl lg:text-6xl"
      style={{ fontWeight: 300, fontVariationSettings: '"wght" 300' }}
    >
      VIRAJ SINGH
    </motion.h1>
  );
}
