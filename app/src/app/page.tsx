'use client';

import { useState, useCallback, useEffect } from 'react';
import { HeroContent } from '@/components/home';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function Home() {
  const [navbarVisible, setNavbarVisible] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('hero-animation-played') === 'true') {
      setSkipAnimation(true);
      setNavbarVisible(true);
    }
  }, []);

  const handleNavbarReady = useCallback(() => {
    localStorage.setItem('hero-animation-played', 'true');
    setNavbarVisible(true);
  }, []);

  useEffect(() => {
    if (!navbarVisible) return;
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
  }, [navbarVisible]);

  return (
    <>
      <Navbar visible={navbarVisible} />
      <main>
        <HeroContent
          skipAnimation={skipAnimation}
          onNavbarReady={handleNavbarReady}
        />
      </main>
      <Footer />
    </>
  );
}
