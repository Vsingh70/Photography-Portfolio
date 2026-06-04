/**
 * Studio publish trigger.
 *
 * After Tauri or iOS Studio finishes pushing photos to Drive, it POSTs here
 * to kick off the variant-rebuild + site-deploy pipeline.
 *
 * Flow:
 *   Studio → POST /api/studio/publish
 *          → this endpoint forwards a repository_dispatch to GitHub
 *          → GitHub Actions runs generate-galleries (Sharp + Drive + R2)
 *          → Action commits the new JSON / manifests to main
 *          → Vercel auto-deploys
 *
 * The GitHub PAT lives only in Vercel env (`GH_DISPATCH_PAT`). Studio
 * clients never carry it, so rotating it doesn't require rebuilding either
 * binary.
 *
 * Rate-limited to a few publishes per minute per IP — the dispatch itself
 * is cheap but a runaway loop would burn GitHub Actions minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface PublishBody {
  /**
   * Which destination(s) had new photos. Used for the dispatch payload so
   * the workflow log shows what changed. Not auth-relevant.
   */
  destinations?: string[];
  /**
   * Optional message logged into the dispatch payload.
   */
  note?: string;
  /**
   * Client name for logging.
   */
  client?: 'tauri' | 'ios' | 'web';
}

export async function POST(req: NextRequest) {
  // Light per-IP throttle: 5 publishes per minute. Generous enough that
  // pushing several sets back to back works without manual delay; tight
  // enough that an abuse loop is curtailed.
  const clientIP = getClientIP(req.headers);
  const result = rateLimit(clientIP, { limit: 5, window: 60 * 1000 });
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too many publish requests. Try again in a minute.',
        resetAt: new Date(result.reset).toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(result.reset),
        },
      }
    );
  }

  // Cursory origin / user-agent check. NOT auth — anyone determined can
  // spoof these. Just makes casual web scanners give up.
  const userAgent = req.headers.get('user-agent') ?? '';
  if (!userAgent || userAgent.length < 5) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // Parse body (best-effort; an empty body is fine).
  let body: PublishBody = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw) as PublishBody;
  } catch {
    body = {};
  }

  // Vercel env config.
  const pat = process.env.GH_DISPATCH_PAT;
  const repo = process.env.GH_DISPATCH_REPO; // e.g. "Vsingh70/Photography-Portfolio"
  if (!pat || !repo) {
    return NextResponse.json(
      {
        error: 'Server not configured for publish — missing GH_DISPATCH_PAT / GH_DISPATCH_REPO.',
      },
      { status: 503 }
    );
  }

  // Forward the dispatch to GitHub.
  const dispatchURL = `https://api.github.com/repos/${repo}/dispatches`;
  const ghResponse = await fetch(dispatchURL, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'vflics-studio-publish/1.0',
    },
    body: JSON.stringify({
      event_type: 'studio-publish',
      client_payload: {
        client: body.client ?? 'unknown',
        destinations: body.destinations ?? [],
        note: body.note ?? '',
        triggeredAt: new Date().toISOString(),
      },
    }),
  });

  if (!ghResponse.ok) {
    const text = await ghResponse.text();
    console.error('[publish] GitHub dispatch failed', ghResponse.status, text);
    return NextResponse.json(
      {
        error: 'Could not trigger publish. Check GH_DISPATCH_PAT scope (needs Contents: Read+Write on the repo).',
        status: ghResponse.status,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Publish triggered. The site will rebuild in 2–6 minutes.',
  });
}

// Lightweight GET so a browser visit isn't an opaque 405.
export async function GET() {
  return NextResponse.json({
    name: 'vflics Studio publish trigger',
    method: 'POST only',
  });
}
