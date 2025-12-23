/**
 * Homepage - Photography Portfolio
 *
 * Features:
 * - Animated hero section with name reveal animation
 * - Post-animation content (paragraph, logo, CTA)
 * - About section
 * - Navigation that fades in after animation completes
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatedHero, HeroContent } from '@/components/home';
import { Navbar } from '@/components/layout/Navbar';

export default function Home() {
  const [animationComplete, setAnimationComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Check if animation has already played in this session
  useEffect(() => {
    const hasPlayedAnimation = sessionStorage.getItem('hero-animation-played');
    if (hasPlayedAnimation === 'true') {
      // Skip animation and show content immediately
      setAnimationComplete(true);
      setShowContent(true);
    }
  }, []);

  const handleAnimationComplete = useCallback(() => {
    // Mark animation as played in session storage
    sessionStorage.setItem('hero-animation-played', 'true');
    setAnimationComplete(true);
    // Slight delay before showing content for smoother transition
    setTimeout(() => {
      setShowContent(true);
    }, 150);
  }, []);

  // Prefetch gallery cover images after animation completes
  useEffect(() => {
    if (animationComplete) {
      // Prefetch gallery covers API data
      fetch('/api/gallery-covers')
        .then((res) => res.json())
        .catch((err) => {
          // Silently fail - prefetch is optional enhancement
          console.warn('Failed to prefetch gallery covers:', err);
        });
    }
  }, [animationComplete]);

  return (
    <>
      {/* Navbar - hidden during animation, fades in after */}
      <Navbar visible={animationComplete} />

      <main>
        {/* Animated Hero Section - hidden after animation completes */}
        {!showContent && <AnimatedHero onComplete={handleAnimationComplete} />}

        {/* Content that appears after animation */}
        {showContent && (
          <>
            <HeroContent />
          </>
        )}
      </main>
    </>
  );
}
