import { notFound } from 'next/navigation';
import { StudioApp } from './StudioApp';

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
