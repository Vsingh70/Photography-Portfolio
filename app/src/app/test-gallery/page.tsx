/**
 * Test Gallery Page
 *
 * This page tests all Phase 2 components with mock data
 * No Google Drive connection required
 */

'use client';

import { useState } from 'react';
import { MasonryGrid, GalleryCard, Lightbox, LightboxImage, LightboxStyles } from '@/components/gallery';
import { Container } from '@/components/ui';
import type { GalleryImage } from '@/types/image';

// Mock image data for testing
const mockImages: GalleryImage[] = [
  {
    id: '1',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    alt: 'Mountain Landscape',
    title: 'Majestic Peaks',
    description: 'Snow-capped mountains under blue sky',
    category: 'Landscapes',
    width: 1200,
    height: 800,
    metadata: {
      camera: 'Canon EOS R5',
      lens: 'RF 24-70mm f/2.8',
      settings: '24mm • f/8 • 1/500s • ISO 100',
      date: '2024-03-15',
    },
  },
  {
    id: '2',
    src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400',
    alt: 'Forest Path',
    title: 'Morning in the Woods',
    description: 'Sunlight filtering through tall trees',
    category: 'Landscapes',
    width: 1200,
    height: 1600,
    metadata: {
      camera: 'Sony A7 IV',
      lens: '24-105mm f/4',
      settings: '35mm • f/5.6 • 1/250s • ISO 200',
    },
  },
  {
    id: '3',
    src: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400',
    alt: 'Lake Reflection',
    title: 'Perfect Reflection',
    description: 'Mountain reflection in still water',
    category: 'Landscapes',
    width: 1200,
    height: 900,
    metadata: {
      camera: 'Nikon Z9',
      lens: '14-24mm f/2.8',
      settings: '16mm • f/11 • 1/125s • ISO 100',
    },
  },
  {
    id: '4',
    src: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=400',
    alt: 'Ocean Sunset',
    title: 'Golden Hour',
    description: 'Sunset over the Pacific Ocean',
    category: 'Landscapes',
    width: 1200,
    height: 800,
  },
  {
    id: '5',
    src: 'https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=400',
    alt: 'Desert Dunes',
    title: 'Sand Patterns',
    description: 'Wind-carved sand dunes at sunset',
    category: 'Landscapes',
    width: 1200,
    height: 1500,
  },
  {
    id: '6',
    src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
    alt: 'Tropical Beach',
    title: 'Paradise Found',
    description: 'Crystal clear water and white sand',
    category: 'Landscapes',
    width: 1200,
    height: 800,
  },
  {
    id: '7',
    src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400',
    alt: 'Waterfall',
    title: 'Cascading Waters',
    description: 'Long exposure waterfall shot',
    category: 'Landscapes',
    width: 1200,
    height: 1800,
  },
  {
    id: '8',
    src: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=1200',
    thumbnail: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=400',
    alt: 'Canyon View',
    title: 'Red Rocks',
    description: 'Dramatic canyon landscape',
    category: 'Landscapes',
    width: 1200,
    height: 900,
  },
];

export default function TestGalleryPage() {
  const [testStatus, setTestStatus] = useState({
    masonryGrid: '⏳ Testing...',
    galleryCard: '⏳ Testing...',
    lightbox: '⏳ Testing...',
    responsive: '⏳ Testing...',
  });

  return (
    <div className="min-h-screen bg-neutral-50 py-12 dark:bg-neutral-950">
      <LightboxStyles />
      <Container>
        {/* Test Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-neutral-900 dark:text-neutral-50">
            Phase 2 Component Testing
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            Testing MasonryGrid, GalleryCard, and Lightbox components with mock data
          </p>
        </div>

        {/* Test Status Dashboard */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TestStatusCard title="MasonryGrid" status={testStatus.masonryGrid} />
          <TestStatusCard title="GalleryCard" status={testStatus.galleryCard} />
          <TestStatusCard title="Lightbox" status={testStatus.lightbox} />
          <TestStatusCard title="Responsive" status={testStatus.responsive} />
        </div>

        {/* Instructions */}
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950">
          <h2 className="mb-3 text-xl font-semibold text-blue-900 dark:text-blue-100">
            Testing Instructions
          </h2>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>✓ <strong>MasonryGrid:</strong> Verify images display in masonry layout</li>
            <li>✓ <strong>GalleryCard:</strong> Hover over images to see metadata overlay</li>
            <li>✓ <strong>Lightbox:</strong> Click any image to open full-screen viewer</li>
            <li>✓ <strong>Navigation:</strong> Use arrow keys or click arrows to navigate</li>
            <li>✓ <strong>Zoom:</strong> Use zoom buttons in lightbox toolbar</li>
            <li>✓ <strong>Responsive:</strong> Resize browser to test different breakpoints</li>
            <li className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <strong>Expected columns:</strong> Mobile (1) → Tablet (2) → Desktop (3-4)
            </li>
          </ul>
        </div>

        {/* Gallery Component Test */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            Test Gallery ({mockImages.length} images)
          </h2>

          <Lightbox images={mockImages}>
            <MasonryGrid
              images={mockImages}
              onImageClick={() => {
                setTestStatus(prev => ({ ...prev, lightbox: '✅ Working' }));
              }}
            >
              {(image, index) => (
                <LightboxImage src={image.src}>
                  <div
                    onLoad={() => {
                      if (index === 0) {
                        setTestStatus(prev => ({
                          ...prev,
                          masonryGrid: '✅ Working',
                          galleryCard: '✅ Working',
                        }));
                      }
                    }}
                  >
                    <GalleryCard
                      image={image}
                      priority={index < 3}
                    />
                  </div>
                </LightboxImage>
              )}
            </MasonryGrid>
          </Lightbox>
        </div>

        {/* Test Info */}
        <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Component Details
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600 dark:text-neutral-400">Total Images:</dt>
              <dd className="font-mono font-semibold text-neutral-900 dark:text-neutral-50">
                {mockImages.length}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600 dark:text-neutral-400">Image Source:</dt>
              <dd className="font-mono font-semibold text-neutral-900 dark:text-neutral-50">
                Unsplash (Mock Data)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600 dark:text-neutral-400">Components:</dt>
              <dd className="font-mono font-semibold text-neutral-900 dark:text-neutral-50">
                MasonryGrid + GalleryCard + Lightbox
              </dd>
            </div>
          </dl>
        </div>
      </Container>
    </div>
  );
}

function TestStatusCard({ title, status }: { title: string; status: string }) {
  const isSuccess = status.includes('✅');
  const isPending = status.includes('⏳');

  return (
    <div
      className={`rounded-lg border p-4 ${
        isSuccess
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
          : isPending
            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
            : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <h3 className="mb-1 text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {title}
      </h3>
      <p
        className={`text-lg font-semibold ${
          isSuccess
            ? 'text-green-700 dark:text-green-300'
            : isPending
              ? 'text-yellow-700 dark:text-yellow-300'
              : 'text-neutral-900 dark:text-neutral-50'
        }`}
      >
        {status}
      </p>
    </div>
  );
}
