import { StudioApp } from './StudioApp';

export const metadata = {
  title: 'Upload Studio',
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  // The page is public. The StudioApp itself shows an empty-state when run
  // outside the Tauri desktop app (where the OAuth + Drive upload pipeline
  // lives), so a browser visitor will see "Use the desktop app." rather than
  // a dead UI.
  return <StudioApp />;
}
