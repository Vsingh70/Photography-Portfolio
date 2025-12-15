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

import { useState, useCallback } from 'react';
import { AnimatedHero, HeroContent, AboutSection } from '@/components/home';
import { Navbar } from '@/components/layout/Navbar';

export default function Home() {
  const [animationComplete, setAnimationComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setAnimationComplete(true);
    // Slight delay before showing content for smoother transition
    setTimeout(() => {
      setShowContent(true);
    }, 500);
  }, []);

  return (
    <>
      {/* Navbar - hidden during animation, fades in after */}
      <Navbar visible={animationComplete} />

      <main>
        {/* Animated Hero Section */}
        <AnimatedHero onComplete={handleAnimationComplete} />

        {/* Content that appears after animation */}
        {showContent && (
          <>
            <HeroContent />
            <AboutSection />
          </>
        )}
      </main>
    </>
  );
}
