import type { Metadata } from 'next';
import { HomeView } from '@/components/home';
import { getWorkIndex, getHeroCover } from '@/lib/projects';

export const dynamic = 'force-static';

// Home tab title is just the wordmark; `absolute` bypasses any title template.
export const metadata: Metadata = { title: { absolute: 'vflics' } };

export default function Home() {
  return <HomeView work={getWorkIndex()} hero={getHeroCover()} />;
}
