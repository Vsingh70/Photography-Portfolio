/**
 * Gallery Category Page (Dynamic Route)
 *
 * Displays all images for a specific gallery category
 * OPTIMIZED: Uses pre-generated static data for instant loading (60-70ms vs 3-4s)
 */

import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Container } from '@/components/ui/Container';
import { GalleryView } from '@/components/gallery/GalleryView';
import { getGalleryBySlug, getAllGallerySlugs } from '@/config/galleries';
import type { GalleryImage } from '@/types/image';

// Import pre-generated gallery data
import editorialImages from '@/generated/gallery-editorial.json';
import graduationImages from '@/generated/gallery-graduation.json';
import portraitsImages from '@/generated/gallery-portraits.json';
import engagementImages from '@/generated/gallery-engagement.json';
import eventsImages from '@/generated/gallery-events.json';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Force static generation for maximum performance
export const dynamic = 'force-static';

/**
 * Generate static params for all gallery categories
 */
export async function generateStaticParams() {
  const slugs = getAllGallerySlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Generate metadata for each gallery category
 */
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const gallery = getGalleryBySlug(slug);

  if (!gallery) {
    return {
      title: 'Gallery Not Found',
    };
  }

  return {
    title: `${gallery.name}`,
    description: gallery.description,
  };
}

/**
 * Pre-generated gallery data lookup
 * Instant loading - no API calls, no Google Drive, no serverless!
 */
const GALLERY_DATA: Record<string, GalleryImage[]> = {
  editorial: editorialImages as GalleryImage[],
  graduation: graduationImages as GalleryImage[],
  portraits: portraitsImages as GalleryImage[],
  engagement: engagementImages as GalleryImage[],
  events: eventsImages as GalleryImage[],
};

/**
 * Get gallery images from pre-generated static data
 */
function getGalleryImages(slug: string): GalleryImage[] {
  const images = GALLERY_DATA[slug];

  if (!images) {
    throw new Error(`No pre-generated data found for gallery: ${slug}`);
  }

  console.log(`⚡ Using pre-generated data for ${slug} (${images.length} images)`);

  return images;
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const gallery = getGalleryBySlug(slug);

  // Return 404 if gallery doesn't exist
  if (!gallery) {
    notFound();
  }

  try {
    const images: GalleryImage[] = getGalleryImages(slug);

    return (
      <>
        <Navbar visible={true} />
        <main className="min-h-screen bg-white dark:bg-black">
          <Container size="xl">
            {/* Category Header */}
            <div className="mb-6 pt-24 text-center md:mb-10 md:pt-28 lg:mb-12 lg:pt-32">
              <h1 className="font-display font-light text-4xl text-primary-900 dark:text-primary-100 md:text-5xl lg:text-6xl">
                {gallery.name}
              </h1>
            </div>

            {/* Gallery Grid with Lightbox */}
            <GalleryView images={images} />
          </Container>
        </main>
      </>
    );
  } catch (error) {
    return (
      <>
        <Navbar visible={true} />
        <main className="min-h-screen bg-white dark:bg-black">
          <Container size="xl">
            <div className="flex min-h-screen flex-col items-center justify-center text-center">
              <h1 className="font-display font-light text-4xl text-primary-900 dark:text-primary-100 md:text-5xl">
                Error Loading Gallery
              </h1>
              <p className="mt-4 text-primary-700 dark:text-primary-300">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
              <p className="mt-2 text-sm text-primary-500 dark:text-primary-500">
                Try running: npm run generate-galleries
              </p>
            </div>
          </Container>
        </main>
      </>
    );
  }
}
