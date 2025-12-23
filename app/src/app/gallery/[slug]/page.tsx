/**
 * Gallery Category Page (Dynamic Route)
 *
 * Displays all images for a specific gallery category
 */

import { notFound } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Container } from '@/components/ui/Container';
import { GalleryView } from '@/components/gallery/GalleryView';
import { getGalleryBySlug, getAllGallerySlugs, getFolderIdForGallery } from '@/config/galleries';
import { fetchImagesFromDrive } from '@/lib/google-drive';
import type { GalleryImage } from '@/types/image';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600; // Revalidate every 1 hour (ISR)

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
      title: 'Gallery Not Found | Viraj Singh Photography',
    };
  }

  return {
    title: `${gallery.name} | Viraj Singh Photography`,
    description: gallery.description,
  };
}

/**
 * Fetch images for a specific gallery category directly from Google Drive
 */
async function getGalleryImages(slug: string) {
  try {
    const gallery = getGalleryBySlug(slug);

    if (!gallery) {
      throw new Error(`Invalid category: ${slug}`);
    }

    // Get folder ID from environment variables
    const folderId = getFolderIdForGallery(gallery);

    if (!folderId) {
      throw new Error(
        `Folder ID not configured for category: ${slug}. Please set ${gallery.folderIdEnvVar} in your environment variables.`
      );
    }

    // Fetch images from Google Drive
    const images = await fetchImagesFromDrive(folderId, gallery.name);

    return images;
  } catch (error) {
    console.error(`Error fetching images for ${slug}:`, error);
    throw error;
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const gallery = getGalleryBySlug(slug);

  // Return 404 if gallery doesn't exist
  if (!gallery) {
    notFound();
  }

  try {
    const images: GalleryImage[] = await getGalleryImages(slug);

    return (
      <>
        <Navbar visible={true} />
        <main className="min-h-screen bg-white pt-24 dark:bg-black md:pt-28 lg:pt-32">
          <Container size="xl">
            {/* Category Header */}
            <div className="mb-12">
              <h1 className="font-display font-light text-4xl text-primary-900 dark:text-primary-100 md:text-5xl lg:text-6xl">
                {gallery.name}
              </h1>
              <p className="mt-4 font-display font-light text-xl text-primary-700 dark:text-primary-300">
                {gallery.description}
              </p>
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
            </div>
          </Container>
        </main>
      </>
    );
  }
}
