/**
 * Gallery Project Page (Dynamic Route)
 *
 * Displays the ordered image sequence for one published project.
 * Pre-generated static data → instant loading, no runtime DB calls.
 *
 * Static-export note: the set of per-project JSON files is data-dependent, so
 * images are read from the build-time-generated server-only registry
 * (`@/generated/projects-registry`), which statically imports each
 * `project-{slug}.json`. Only the selected project's `images` array is passed
 * to the client `GalleryView`; the rest never leave the server bundle.
 */

import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { GalleryView } from '@/components/gallery/GalleryView';
import { getWorkIndex } from '@/lib/projects';
import { PROJECT_IMAGES } from '@/generated/projects-registry';
import type { GalleryImage } from '@/types/image';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Force static generation for maximum performance.
export const dynamic = 'force-static';

/** Generate static params for every published project. */
export async function generateStaticParams() {
  return getWorkIndex().map((entry) => ({ slug: entry.slug }));
}

/** Per-project metadata derived from the generated index. */
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const entry = getWorkIndex().find((w) => w.slug === slug);
  if (!entry) {
    return { title: 'Gallery Not Found' };
  }
  return {
    title: entry.title,
    description: entry.blurb || undefined,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getWorkIndex().find((w) => w.slug === slug);
  const images: GalleryImage[] | undefined = PROJECT_IMAGES[slug];

  // Unknown / unpublished slug → 404.
  if (!entry || !images) {
    notFound();
  }

  return (
    <>
      <Navbar visible={true} />
      <main className="min-h-screen bg-paper">
        {/* Editorial masthead */}
        <header className="mx-auto max-w-[760px] px-5 pb-[clamp(34px,6vw,64px)] pt-[clamp(96px,12vw,140px)] text-center sm:px-8">
          {entry.category && (
            <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-accent">
              {entry.category}
            </div>
          )}
          <h1 className="mt-5 font-display font-light italic leading-[0.96] tracking-[-0.01em] text-ink [font-size:clamp(48px,9vw,116px)]">
            {entry.title}
          </h1>
          {entry.blurb && (
            <p className="mx-auto mt-7 max-w-[52ch] text-[clamp(16px,1.9vw,21px)] leading-[1.6] text-ink-soft [text-wrap:pretty]">
              {entry.blurb}
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="meta text-[10.5px]">2026</span>
            <span className="meta text-[10.5px]">{images.length} frames</span>
            <span className="meta text-[10.5px]">50mm</span>
          </div>
        </header>

        {/* Editorial image sequence + lightbox */}
        <GalleryView images={images} seriesLabel={entry.title} />
      </main>
      <Footer />
    </>
  );
}
