/**
 * Google Drive Integration Test - Portraits Gallery
 *
 * Simplified test page focusing on portraits folder only
 * Tests: API fetching, image quality, lightbox, masonry grid
 */

'use client';

import { useState, useEffect } from 'react';
import { MasonryGrid, GalleryCard, Lightbox, LightboxImage, LightboxStyles } from '@/components/gallery';
import { Container } from '@/components/ui';
import type { GalleryImage } from '@/types/image';

export default function TestDriveGalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTime, setFetchTime] = useState<number>(0);

  useEffect(() => {
    const startTime = Date.now();

    fetch('/api/google-drive?category=portraits')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch images');
        }
        setImages(data.images || []);
        setFetchTime(Date.now() - startTime);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        setFetchTime(Date.now() - startTime);
      });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 py-12 dark:bg-neutral-950">
      <LightboxStyles />
      <Container>
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-neutral-900 dark:text-neutral-50">
            Portraits Gallery - Quality Test
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            Testing Google Drive integration with lightbox and masonry grid
          </p>
        </div>

        {/* Status Dashboard */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard
            title="API Status"
            status={loading ? 'Loading...' : error ? '❌ Error' : '✅ Connected'}
            color={loading ? 'yellow' : error ? 'red' : 'green'}
          />
          <StatusCard
            title="Images Found"
            status={loading ? '...' : error ? '0' : images.length.toString()}
            color={loading ? 'yellow' : error ? 'red' : 'green'}
          />
          <StatusCard
            title="Load Time"
            status={loading ? '...' : `${fetchTime}ms`}
            color={loading ? 'yellow' : fetchTime < 2000 ? 'green' : 'yellow'}
          />
        </div>

        {/* Quality Testing Instructions */}
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950">
          <h2 className="mb-3 text-xl font-semibold text-blue-900 dark:text-blue-100">
            🎯 Quality Testing Checklist
          </h2>
          <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
            <div>
              <strong>Step 1: Grid Display</strong>
              <p className="ml-4 mt-1">Verify thumbnails (400px) load clearly in masonry layout</p>
            </div>
            <div>
              <strong>Step 2: Open Lightbox</strong>
              <p className="ml-4 mt-1">Click any image - lightbox should open with full-size version</p>
            </div>
            <div>
              <strong>Step 3: Verify Image Quality</strong>
              <p className="ml-4 mt-1">
                • Open <strong>DevTools (F12)</strong> → <strong>Network</strong> tab
                <br />
                • Look for URL with{' '}
                <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">export=view</code>
                <br />
                • Right-click image → <strong>Open in new tab</strong>
                <br />• Check dimensions (should be original resolution, e.g. 4000×3000)
              </p>
            </div>
            <div>
              <strong>Step 4: Test Zoom</strong>
              <p className="ml-4 mt-1">Use zoom controls (+/-) - image should remain crisp, no pixelation</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
            <h3 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
              ❌ Error Loading Portraits
            </h3>
            <p className="mb-4 font-mono text-sm text-red-800 dark:text-red-200">{error}</p>
            <div className="space-y-2 text-sm text-red-700 dark:text-red-300">
              <p className="font-semibold">Troubleshooting Steps:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Verify <code className="rounded bg-red-100 px-1 dark:bg-red-900">GOOGLE_DRIVE_PORTRAITS_FOLDER_ID</code> is set in .env.local</li>
                <li>Check service account has View access to portraits folder</li>
                <li>Test API directly: <code className="rounded bg-red-100 px-1 dark:bg-red-900">/api/google-drive?category=portraits</code></li>
                <li>Check browser console for detailed error messages</li>
              </ul>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-blue-600"></div>
              <p className="text-neutral-600 dark:text-neutral-400">
                Fetching images from Google Drive...
              </p>
            </div>
          </div>
        )}

        {/* Image Quality Metrics */}
        {!loading && !error && images.length > 0 && (
          <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
            <h3 className="mb-4 text-lg font-semibold text-green-900 dark:text-green-100">
              📊 Technical Details (First Image)
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-green-700 dark:text-green-300">
                    Thumbnail URL (Grid)
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-green-800 dark:text-green-200">
                    {images[0]?.thumbnail}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-green-700 dark:text-green-300">
                    Full-Size URL (Lightbox)
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-green-800 dark:text-green-200">
                    {images[0]?.src}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {images[0]?.width && (
                  <div className="rounded-lg border border-green-300 bg-white p-3 dark:border-green-700 dark:bg-green-900">
                    <p className="text-xs text-green-600 dark:text-green-400">Dimensions</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-green-900 dark:text-green-100">
                      {images[0].width}×{images[0].height}
                    </p>
                  </div>
                )}
                {images[0]?.metadata?.camera && (
                  <div className="rounded-lg border border-green-300 bg-white p-3 dark:border-green-700 dark:bg-green-900">
                    <p className="text-xs text-green-600 dark:text-green-400">Camera</p>
                    <p className="mt-1 text-xs font-medium text-green-900 dark:text-green-100">
                      {images[0].metadata.camera}
                    </p>
                  </div>
                )}
                {images[0]?.metadata?.settings && (
                  <div className="col-span-2 rounded-lg border border-green-300 bg-white p-3 dark:border-green-700 dark:bg-green-900">
                    <p className="text-xs text-green-600 dark:text-green-400">Settings</p>
                    <p className="mt-1 font-mono text-xs font-medium text-green-900 dark:text-green-100">
                      {images[0].metadata.settings}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Gallery Component Test */}
        {!loading && !error && images.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
                Portraits Gallery
              </h2>
              <span className="rounded-full bg-neutral-200 px-3 py-1 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {images.length} {images.length === 1 ? 'image' : 'images'}
              </span>
            </div>

            <Lightbox images={images}>
              <MasonryGrid images={images}>
                {(image, index) => (
                  <LightboxImage src={image.src} key={image.id}>
                    <GalleryCard
                      image={image}
                      priority={index < 3}
                      onClick={() => {
                        console.log('Image clicked:', image.title, 'src:', image.src);
                      }}
                    />
                  </LightboxImage>
                )}
              </MasonryGrid>
            </Lightbox>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && images.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
              No images found in portraits folder
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
              Add images to your Google Drive portraits folder: <br />
              <code className="mt-1 inline-block rounded bg-neutral-200 px-2 py-1 font-mono text-xs dark:bg-neutral-800">
                1CF7yYOl4Y-uWkzqvmw_0-3HFbShKiRkB
              </code>
            </p>
          </div>
        )}
      </Container>
    </div>
  );
}

function StatusCard({
  title,
  status,
  color,
}: {
  title: string;
  status: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const colorClasses = {
    green: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    yellow: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    red: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
  };

  const textColorClasses = {
    green: 'text-green-700 dark:text-green-300',
    yellow: 'text-yellow-700 dark:text-yellow-300',
    red: 'text-red-700 dark:text-red-300',
    blue: 'text-blue-700 dark:text-blue-300',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <h3 className="mb-1 text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {title}
      </h3>
      <p className={`text-lg font-semibold ${textColorClasses[color]}`}>{status}</p>
    </div>
  );
}
