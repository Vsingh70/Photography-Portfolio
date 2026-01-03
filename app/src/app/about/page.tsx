/**
 * About Page - Photography Portfolio
 *
 * Features:
 * - Centered title using Canela font
 * - Desktop: Text left, Image right
 * - Mobile: Title top, Image middle, Text bottom
 * - Fade-in animation matching home page
 * - Theme-aware colors
 * - OPTIMIZED: Uses pre-generated static image for instant loading
 */

import { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui';
import { AboutContent } from './AboutContent';
import aboutImageData from '@/generated/about-image.json';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn more about Viraj Singh.',
};

export const revalidate = 3600; // Revalidate every 1 hour (ISR)
export const dynamic = 'force-static'; // Force static generation

export default function AboutPage() {
  return (
    <>
      <Navbar visible={true} />
      <main className="min-h-screen bg-white dark:bg-black">
        <Container size="xl">
          <AboutContent imageData={aboutImageData} />
        </Container>
      </main>
      <Footer />
    </>
  );
}
