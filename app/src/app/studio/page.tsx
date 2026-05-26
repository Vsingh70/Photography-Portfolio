import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';

const StudioApp = dynamic(() => import('./StudioApp').then((m) => m.StudioApp), {
  ssr: false,
});

export const metadata = {
  title: 'Upload Studio',
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }
  return <StudioApp />;
}
