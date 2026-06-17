import { HomeView } from '@/components/home';
import { getWorkIndex, getHeroCover } from '@/lib/projects';

export const dynamic = 'force-static';

export default function Home() {
  return <HomeView work={getWorkIndex()} hero={getHeroCover()} />;
}
