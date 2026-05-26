import { NextRequest, NextResponse } from 'next/server';
import { studioKeyMatches } from '@/lib/studio-auth';

const BUILT_IN = [
  { slug: 'editorial',  label: 'Editorial',  envVar: 'GOOGLE_DRIVE_EDITORIAL_FOLDER_ID' },
  { slug: 'portraits',  label: 'Portraits',  envVar: 'GOOGLE_DRIVE_PORTRAITS_FOLDER_ID' },
  { slug: 'graduation', label: 'Graduation', envVar: 'GOOGLE_DRIVE_GRADUATION_FOLDER_ID' },
  { slug: 'engagement', label: 'Engagement', envVar: 'GOOGLE_DRIVE_ENGAGEMENT_FOLDER_ID' },
  { slug: 'events',     label: 'Events',     envVar: 'GOOGLE_DRIVE_EVENTS_FOLDER_ID' },
  { slug: 'about',      label: 'About',      envVar: 'GOOGLE_DRIVE_ABOUT_FOLDER_ID' },
];

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!studioKeyMatches(key)) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  return NextResponse.json({
    builtIn: BUILT_IN.map((d) => ({
      slug: d.slug,
      label: d.label,
      folderId: process.env[d.envVar] || null,
    })),
  });
}
