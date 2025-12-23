/**
 * Gallery Page
 *
 * Main gallery landing page displaying cover images for each gallery category
 */

import { Navbar } from '@/components/layout/Navbar';
import { Container } from '@/components/ui/Container';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { fetchImagesFromDrive } from '@/lib/google-drive';
import { GALLERY_COVER_MAPPINGS, getCoverImageMapping } from '@/config/gallery-covers';
import type { GalleryCover } from '@/types/gallery';

export const revalidate = 3600; // Revalidate every 1 hour (ISR)

export const metadata = {
  title: 'Gallery | Viraj Singh Photography',
  description: 'Explore photography galleries showcasing editorial, portraits, events, and more.',
};

/**
 * Fetch gallery cover images directly from Google Drive
 */
async function getGalleryCovers() {
  try {
    const galleryFolderId = process.env.GOOGLE_DRIVE_GALLERY_FOLDER_ID;

    if (!galleryFolderId) {
      throw new Error('Gallery folder ID not configured');
    }

    // Fetch all images from the gallery folder
    const allImages = await fetchImagesFromDrive(galleryFolderId, 'Gallery');

    // Filter to only include cover images and map them to gallery categories
    const covers: GalleryCover[] = [];

    for (const image of allImages) {
      // Check if this image filename matches any of our cover mappings
      const mapping = getCoverImageMapping(image.title + '.jpg');

      if (mapping) {
        covers.push({
          id: image.id,
          category: mapping.displayTitle,
          slug: mapping.categorySlug,
          title: mapping.displayTitle,
          imageUrl: image.src,
          width: image.width || 1920,
          height: image.height || 1080,
        });
      }
    }

    // Sort covers by display order
    const sortedCovers = covers.sort((a, b) => {
      const orderA =
        GALLERY_COVER_MAPPINGS.find((m) => m.categorySlug === a.slug)?.displayOrder || 999;
      const orderB =
        GALLERY_COVER_MAPPINGS.find((m) => m.categorySlug === b.slug)?.displayOrder || 999;
      return orderA - orderB;
    });

    return {
      success: true,
      count: sortedCovers.length,
      covers: sortedCovers,
    };
  } catch (error) {
    console.error('Error fetching gallery covers:', error);
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
      </>
    );
  }
}
