import { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
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
        <ContactContent />
      </main>
      <Footer />
    </>
  );
}
