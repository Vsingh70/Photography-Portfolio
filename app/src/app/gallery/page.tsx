/**
 * Gallery — editorial project index ("contents page").
 *
 * Statically generated from the pre-built work index (covers + frame counts).
 * No runtime data calls; the public site keeps serving from the R2 CDN.
 */

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { GalleryIndex } from '@/components/gallery/GalleryIndex';
import { getWorkIndex } from '@/lib/projects';

export const revalidate = 3600; // ISR
export const dynamic = 'force-static';

export const metadata = {
  title: 'Gallery',
  description:
    'Selected editorial photography by Viraj Singh — fashion, portraiture, and brand stories.',
};

export default function GalleryPage() {
  const work = getWorkIndex();

  return (
    <>
      <Navbar visible={true} />
      <main className="min-h-screen bg-paper">
        {work.length === 0 ? (
          <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
            <h1 className="font-display text-4xl font-light italic text-ink md:text-5xl">
              Index unavailable
            </h1>
            <p className="mt-4 text-ink-soft">No work to show yet — check back soon.</p>
          </div>
        ) : (
          <GalleryIndex work={work} />
        )}
      </main>
      <Footer />
    </>
  );
}
