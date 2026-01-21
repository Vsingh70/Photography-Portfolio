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
import { Footer } from '@/components/layout/Footer';

export default function Home() {
  const [animationComplete, setAnimationComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Check if animation has already played (persists across browser sessions)
  useEffect(() => {
    const hasPlayedAnimation = localStorage.getItem('hero-animation-played');
    if (hasPlayedAnimation === 'true') {
      // Skip animation and show content immediately for returning users
      setAnimationComplete(true);
      setShowContent(true);
    }
  }, []);

  const handleAnimationComplete = useCallback(() => {
    // Mark animation as played in localStorage (persists across sessions)
    localStorage.setItem('hero-animation-played', 'true');
    setAnimationComplete(true);
    // Slight delay before showing content for smoother transition
    setTimeout(() => {
      setShowContent(true);
    }, 150);
  }, []);

  // Handle when user skips the animation via input
  const handleAnimationSkip = useCallback(() => {
    // Mark animation as played in localStorage
    localStorage.setItem('hero-animation-played', 'true');
    setAnimationComplete(true);
    // Show content immediately when skipped (no delay needed)
    setShowContent(true);
  }, []);

  // Prefetch gallery cover images after animation completes
  useEffect(() => {
    if (animationComplete) {
      // Prefetch pre-generated static gallery cover images
      const coverImages = [
        '/gallery-covers/editorial.webp',
        '/gallery-covers/graduation.webp',
        '/gallery-covers/portraits.webp',
        '/gallery-covers/engagement.webp',
        '/gallery-covers/events.webp',
      ];

      coverImages.forEach((src) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
      });

      console.log('⚡ Prefetched gallery cover images');
    }
  }, [animationComplete]);

  return (
    <>
      {/* Navbar - hidden during animation, fades in after */}
      <Navbar visible={animationComplete} />

      <main>
        {/* Animated Hero Section - hidden after animation completes */}
        {!showContent && <AnimatedHero onComplete={handleAnimationComplete} onSkip={handleAnimationSkip} />}

        {/* Content that appears after animation */}
        {showContent && (
          <>
            <HeroContent />
          </>
        )}
      </main>

      {/* Footer - shown after animation completes */}
      {showContent && <Footer />}
    </>
  );
}
