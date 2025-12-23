/**
 * Gallery Category Page (Dynamic Route)
 *
 * Displays all images for a specific gallery category
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Container } from '@/components/ui/Container';
import { MasonryGrid } from '@/components/gallery/MasonryGrid';
import { GalleryCard } from '@/components/gallery/GalleryCard';
import { Lightbox, LightboxImage, LightboxStyles } from '@/components/gallery/Lightbox';
import { getGalleryBySlug } from '@/config/galleries';
import type { GalleryImage } from '@/types/image';

export default function CategoryPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const gallery = getGalleryBySlug(slug);

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGalleryImages() {
      try {
        setLoading(true);
        const response = await fetch(`/api/gallery/${slug}`);

        if (!response.ok) {
          throw new Error('Failed to load gallery');
        }

        const data = await response.json();
        setImages(data.images || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchGalleryImages();
    }
  }, [slug]);

  // Return 404 if gallery doesn't exist
  if (!gallery) {
    return (
      <>
        <Navbar visible={true} />
        <main className="min-h-screen bg-white dark:bg-black">
          <Container size="xl">
            <div className="flex min-h-screen flex-col items-center justify-center text-center">
              <h1 className="font-display font-light text-4xl text-primary-900 dark:text-primary-100 md:text-5xl">
                Gallery Not Found
              </h1>
              <p className="mt-4 text-primary-700 dark:text-primary-300">
                The gallery you're looking for doesn't exist.
              </p>
            </div>
          </Container>
        </main>
      </>
    );
  }

  if (error) {
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
                {error}
              </p>
            </div>
          </Container>
        </main>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Navbar visible={true} />
        <main className="min-h-screen bg-white pt-24 dark:bg-black md:pt-28 lg:pt-32">
          <Container size="xl">
            <div className="mb-12">
              <h1 className="font-display font-light text-4xl text-primary-900 dark:text-primary-100 md:text-5xl lg:text-6xl">
                {gallery.name}
              </h1>
              <p className="mt-4 font-display font-light text-xl text-primary-700 dark:text-primary-300">
                {gallery.description}
              </p>
            </div>
            <div className="flex items-center justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-900 dark:border-primary-800 dark:border-t-primary-100" />
            </div>
          </Container>
        </main>
      </>
    );
  }

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
          {images.length > 0 ? (
            <>
              <Lightbox images={images}>
                <MasonryGrid images={images}>
                  {(image: GalleryImage, index: number) => (
                    <LightboxImage key={image.id} src={image.src}>
                      <div>
                        <GalleryCard
                          image={image}
                          priority={index < 6}
                          onClick={() => {}}
                        />
                      </div>
                    </LightboxImage>
                  )}
                </MasonryGrid>
              </Lightbox>
              <LightboxStyles />
            </>
          ) : (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <p className="text-lg text-primary-700 dark:text-primary-300">
                No images found in this gallery.
              </p>
              <p className="mt-2 text-sm text-primary-500 dark:text-primary-500">
                Check back soon for new additions.
              </p>
            </div>
          )}
        </Container>
      </main>
    </>
  );
}
