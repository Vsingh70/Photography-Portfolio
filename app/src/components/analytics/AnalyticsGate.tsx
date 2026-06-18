'use client';

import { usePathname } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Mounts Vercel Analytics + Speed Insights on the public site only.
 *
 * The authenticated Studio (`/studio`) is a heavy client SPA that holds large
 * in-memory image data (blobs + thumbnails). Instrumenting it would (a) pollute
 * the public site's Core Web Vitals with admin interactions, and (b) run the
 * `performance.measure`/web-vitals hooks against that memory — which can fail a
 * structured clone ("out of memory") on big sessions. Gate them out there.
 */
export function AnalyticsGate() {
  const pathname = usePathname();
  if (pathname?.startsWith('/studio')) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
