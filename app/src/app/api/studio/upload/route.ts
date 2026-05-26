import { NextRequest, NextResponse } from 'next/server';
import { uploadToDrive } from '@/lib/drive-upload';
import { studioKeyMatches } from '@/lib/studio-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!studioKeyMatches(key)) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const form = await req.formData();
    const setName = String(form.get('setName') || '').trim();
    const folderId = String(form.get('folderId') || '').trim();

    if (!setName || !folderId) {
      return NextResponse.json(
        { error: 'setName and folderId are required' },
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
    console.error('[studio/upload]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
