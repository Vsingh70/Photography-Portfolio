import type { Metadata } from 'next';
import { StudioApp } from './StudioApp';

export const metadata: Metadata = {
  title: 'vflics Studio',
  robots: { index: false, follow: false },
  // PWA: link the Studio manifest (installable standalone app). The root
  // layout is intentionally untouched — this only applies to /studio.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'vflics Studio',
  },
  other: {
    'theme-color': '#0a0a0a',
  },
};

export default function StudioPage() {
  // Single authenticated web/PWA Project composer (Supabase-backed). The
  // StudioApp gates itself behind a Supabase session: unauthenticated visitors
  // see the passkey / password sign-in screen, not the composer.
  return <StudioApp />;
}
