/**
 * Contact Page - Photography Portfolio
 *
 * Features:
 * - Contact form with validation
 * - Contact information sidebar
 * - Fade-in animation matching home page
 * - Theme-aware styling
 */

import { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui';
import { ContactContent } from './ContactContent';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Viraj for bookings, inquiries, or collaborations.',
};

export default function ContactPage() {
  return (
    <>
      <Navbar visible={true} />
      <main className="min-h-screen bg-white dark:bg-black">
        <Container size="lg">
          <ContactContent />
        </Container>
      </main>
      <Footer />
    </>
  );
}
