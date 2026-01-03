/**
 * Gallery Page
 *
 * Main gallery landing page displaying cover images for each gallery category
 * OPTIMIZED: Uses pre-generated static thumbnails for instant loading
 */

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/ui/Container';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import type { GalleryCover } from '@/types/gallery';
import coverThumbnails from '@/generated/cover-thumbnails.json';

export const revalidate = 3600; // Revalidate every 1 hour (ISR)
export const dynamic = 'force-static'; // Force static generation

export const metadata = {
  title: 'Gallery | Viraj Singh Photography',
  description: 'Explore photography galleries showcasing editorial, portraits, events, and more.',
};

/**
 * Get gallery cover images from pre-generated thumbnails
 * INSTANT LOADING: No API calls, no Google Drive, no serverless cold starts!
 */
async function getGalleryCovers() {
  try {
    console.log('⚡ Using pre-generated static thumbnails (INSTANT loading!)');

    // Map pre-generated thumbnails to GalleryCover format
    const covers: GalleryCover[] = coverThumbnails.map((thumbnail) => ({
      id: thumbnail.categorySlug,
      category: thumbnail.displayTitle,
      slug: thumbnail.categorySlug,
      title: thumbnail.displayTitle,
      imageUrl: thumbnail.path, // Static file path: /gallery-covers/editorial.webp
      width: thumbnail.width,
      height: thumbnail.height,
    }));

    // Already sorted by displayOrder in the JSON
    return {
      success: true,
      count: covers.length,
      covers,
    };
  } catch (error) {
    console.error('Error loading gallery covers:', error);
    throw error;
  }
}

export default async function GalleryPage() {
  try {
    const data = await getGalleryCovers();

    if (!data.success || data.covers.length === 0) {
      return (
        <>
          <Navbar visible={true} />
          <main className="min-h-screen bg-white dark:bg-black">
            <Container size="xl">
              <div className="flex min-h-screen flex-col items-center justify-center text-center">
                <h1 className="font-display font-light text-4xl text-primary-900 dark:text-primary-100 md:text-5xl">
                  Gallery Unavailable
                </h1>
                <p className="mt-4 text-primary-700 dark:text-primary-300">
                  No gallery images found. Please check back soon.
                </p>
              </div>
            </Container>
          </main>
          <Footer />
        </>
      );
    }

    return (
      <>
        <Navbar visible={true} />
        <main className="min-h-screen bg-white dark:bg-black">
          <Container size="xl">
            <GalleryGrid covers={data.covers} />
          </Container>
        </main>
        <Footer />
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
            </div>
          </Container>
        </main>
        <Footer />
      </>
    );
  }
}
