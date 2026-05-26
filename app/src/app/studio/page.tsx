import { notFound } from 'next/navigation';
import { StudioApp } from './StudioApp';
import { studioKeyMatches } from '@/lib/studio-auth';

export const metadata = {
  title: 'Upload Studio',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function StudioPage({ searchParams }: PageProps) {
  const { key } = await searchParams;
  if (!studioKeyMatches(key)) {
    notFound();
  }
  return <StudioApp />;
}
