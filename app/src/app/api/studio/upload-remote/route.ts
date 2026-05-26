/**
 * Auth-gated upload endpoint for remote clients (iOS app, etc).
 *
 * Same logic as /api/studio/upload but gated by a shared-secret bearer token
 * instead of NODE_ENV. The token is set on Vercel as STUDIO_UPLOAD_TOKEN and
 * sent by clients in the Authorization header:
 *
 *   Authorization: Bearer <token>
 *
 * Required Vercel env vars:
 *   STUDIO_UPLOAD_TOKEN              long random string
 *   GOOGLE_DRIVE_CLIENT_EMAIL
 *   GOOGLE_DRIVE_PRIVATE_KEY
 *   GOOGLE_DRIVE_{EDITORIAL|PORTRAITS|GRADUATION|ENGAGEMENT|EVENTS|ABOUT}_FOLDER_ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadToDrive } from '@/lib/drive-upload';

export const runtime = 'nodejs';
export const maxDuration = 300;

const DESTINATION_ENV: Record<string, string> = {
  editorial:  'GOOGLE_DRIVE_EDITORIAL_FOLDER_ID',
  portraits:  'GOOGLE_DRIVE_PORTRAITS_FOLDER_ID',
  graduation: 'GOOGLE_DRIVE_GRADUATION_FOLDER_ID',
  engagement: 'GOOGLE_DRIVE_ENGAGEMENT_FOLDER_ID',
  events:     'GOOGLE_DRIVE_EVENTS_FOLDER_ID',
  about:      'GOOGLE_DRIVE_ABOUT_FOLDER_ID',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorize(req: NextRequest): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.STUDIO_UPLOAD_TOKEN;
  if (!expected) {
    return { ok: false, status: 503, error: 'Studio upload not configured' };
  }
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'Missing bearer token' };
  }
  if (!timingSafeEqual(match[1], expected)) {
    return { ok: false, status: 401, error: 'Invalid token' };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  // List which built-in destinations are configured. The iOS app calls this
  // on launch to populate its destination picker.
  const destinations = Object.entries(DESTINATION_ENV)
    .map(([slug, envVar]) => ({
      slug,
      folderId: process.env[envVar] || null,
    }))
    .filter((d) => d.folderId);
  return NextResponse.json({ destinations });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const form = await req.formData();
    const setName = String(form.get('setName') || '').trim();
    const destinationSlug = String(form.get('destination') || '').trim();
    const customFolderId = String(form.get('folderId') || '').trim();

    if (!setName) {
      return NextResponse.json({ error: 'setName required' }, { status: 400 });
    }

    // Either a known destination slug or an explicit folderId.
    let folderId = customFolderId;
    if (!folderId && destinationSlug) {
      const envVar = DESTINATION_ENV[destinationSlug];
      if (envVar) folderId = process.env[envVar] || '';
    }
    if (!folderId) {
      return NextResponse.json(
        { error: 'destination (slug) or folderId required' },
        { status: 400 }
      );
    }

    const files = form.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    const results: Array<{ index: number; renamed: string; id: string; name: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = (file.name.match(/\.[^.]+$/)?.[0] || '.jpg').toLowerCase();
      const renamed = `${setName} (${i + 1})${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadToDrive({
        folderId,
        filename: renamed,
        mimeType: file.type || 'image/jpeg',
        buffer,
      });
      results.push({ index: i, renamed, ...result });
    }

    return NextResponse.json({ ok: true, uploaded: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[studio/upload-remote]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
