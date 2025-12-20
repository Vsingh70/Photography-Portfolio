/**
 * Animation Configuration for Homepage Hero
 *
 * This file centralizes all timing, easing, and animation settings.
 * Adjust values here to fine-tune the animation feel without touching component code.
 */

export const HERO_ANIMATION_CONFIG = {
  // Enable/disable animation (useful for testing or accessibility)
  enabled: true,

  // Phase durations (in milliseconds)
  timings: {
    // Initial display of "VFLICS"
    initial: 750,

    // Transition 1: "FLICS" slides right, "IRAJ " fades in → "VIRAJ FLICS"
    transition1: 500, // Reduced to a quarter of the original 2500ms

    // Hold "VIRAJ FLICS" state
    hold1: 500, // Remains at a quarter of the original 2500ms

    // Transition 2: "S" moves left, "FLIC" fades out → "VIRAJ S"
    transition2: 1500,

    // Transition 3: "INGH" fades in letter-by-letter → "VIRAJ SINGH"
    transition3: 625, // Reduced to a quarter of the original 2500ms

    // Delay between each letter in "INGH"
    letterStagger: 150,

    // Hold final "VIRAJ SINGH" state before fading out
    finalHold: 1500,

    // Fade out "VIRAJ SINGH" completely
    fadeOut: 250,
  },

  // Easing curves (cubic-bezier values for smooth animations)
  easing: {
    // For sliding text movements (smooth acceleration/deceleration)
    slide: [0.65, 0, 0.35, 1] as [number, number, number, number],

    // For fading in elements
    fadeIn: [0.4, 0, 0.2, 1] as [number, number, number, number],

    // For fading out elements
    fadeOut: [0.4, 0, 1, 1] as [number, number, number, number],

    // Alternative: subtle bounce effect (optional, currently unused)
    bounce: [0.68, -0.55, 0.265, 1.55] as [number, number, number, number],
  },

  // Responsive font sizes for the animated text
  fontSize: {
    mobile: '3rem', // 48px - for screens < 768px
    tablet: '5rem', // 80px - for screens 768px - 1024px
    desktop: '8rem', // 128px - for screens > 1024px
  },
} as const;

/**
 * Calculate total animation duration
 * Useful for coordination with other components
 */
export const getTotalAnimationDuration = () => {
  const { timings } = HERO_ANIMATION_CONFIG;
  return (
    timings.initial +
    timings.transition1 +
    timings.hold1 +
    timings.transition2 +
    timings.transition3 +
    timings.finalHold +
    timings.fadeOut
  );
};
