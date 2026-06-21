'use client';

/**
 * Site settings panel (req 1 + 4): set the home hero image and the about image.
 * Each picks an existing image across any project and writes
 * site_settings.hero_image_id / about_image_id. Current selections show as
 * signed-URL thumbnails with a swap action.
 */

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  loadImageCatalog,
  loadSiteSettings,
  setSiteImage,
  signedThumb,
  type CatalogImage,
} from '@/lib/studio/remote';
import { uploadSiteImage } from '@/lib/studio/siteImages';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Cap, Pill, Rule, Heading, DIM } from './ui';

type Client = SupabaseClient<Database>;
type SiteField = 'hero_image_id' | 'about_image_id';

function ThumbPreview({ url, label }: { url: string | null; label: string }) {
  return (
    <div
      style={{
        width: 120,
        height: 150,
        background: url ? `url("${url}") center/cover no-repeat #1a1a1a` : '#1a1a1a',
        border: '1px solid rgba(245,243,238,0.12)',
        display: url ? 'block' : 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {!url && <Cap style={{ color: 'rgba(245,243,238,0.35)' }}>{label}</Cap>}
    </div>
  );
}

function ImagePickerModal({
  catalog,
  thumbUrls,
  onPick,
  onClose,
}: {
  catalog: CatalogImage[];
  thumbUrls: Record<string, string>;
  onPick: (img: CatalogImage) => void;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        padding: isMobile ? 12 : 28,
      }}
    >
      <div
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(245,243,238,0.12)',
          maxWidth: 820,
          width: '100%',
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: isMobile ? 16 : 28,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Heading size={32}>Pick an image.</Heading>
          <Pill onClick={onClose}>Close</Pill>
        </div>
        <Rule style={{ margin: '16px 0' }} />
        {catalog.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: DIM }}>
            No images yet — publish a project first.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 12,
            }}
          >
            {catalog.map((img) => (
              <button
                key={img.id}
                onClick={() => onPick(img)}
                title={`${img.projectTitle} — ${img.alt || img.storage_path}`}
                style={{
                  padding: 0,
                  border: '1px solid rgba(245,243,238,0.1)',
                  cursor: 'pointer',
                  background: thumbUrls[img.id]
                    ? `url("${thumbUrls[img.id]}") center/cover no-repeat #1a1a1a`
                    : '#1a1a1a',
                  height: 138,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPanel({
  supabase,
  onChanged,
}: {
  supabase: Client;
  /** Fired after the hero/about image is changed, so the parent can enable the
   * top-bar Publish button to trigger the rebuild that makes it live. */
  onChanged?: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogImage[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [heroId, setHeroId] = useState<string | null>(null);
  const [aboutId, setAboutId] = useState<string | null>(null);
  const [picking, setPicking] = useState<SiteField | null>(null);
  const [uploading, setUploading] = useState<SiteField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFieldRef = useRef<SiteField | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cat, settings] = await Promise.all([
          loadImageCatalog(supabase),
          loadSiteSettings(supabase),
        ]);
        if (cancelled) return;
        setCatalog(cat);
        setHeroId(settings.heroImageId);
        setAboutId(settings.aboutImageId);

        const entries = await Promise.all(
          cat.map(async (img) => [img.id, await signedThumb(supabase, img.storage_path)] as const)
        );
        if (cancelled) return;
        const urls: Record<string, string> = {};
        for (const [id, url] of entries) if (url) urls[id] = url;
        setThumbUrls(urls);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load settings.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const choose = async (img: CatalogImage) => {
    if (!picking) return;
    const field = picking;
    setPicking(null);
    setError(null);
    try {
      await setSiteImage(supabase, field, img.id);
      if (field === 'hero_image_id') setHeroId(img.id);
      else setAboutId(img.id);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    }
  };

  const triggerUpload = (field: SiteField) => {
    if (uploading) return;
    uploadFieldRef.current = field;
    setError(null);
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    const field = uploadFieldRef.current;
    if (!file || !field) return;
    setUploading(field);
    setError(null);
    try {
      const { id, dataURL } = await uploadSiteImage(supabase, file, field);
      setThumbUrls((prev) => ({ ...prev, [id]: dataURL }));
      if (field === 'hero_image_id') setHeroId(id);
      else setAboutId(id);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(null);
      uploadFieldRef.current = null;
    }
  };

  const heroUrl = heroId ? thumbUrls[heroId] ?? null : null;
  const aboutUrl = aboutId ? thumbUrls[aboutId] ?? null : null;

  return (
    <div>
      <Cap style={{ color: DIM }}>Site settings</Cap>
      <Heading size={40} style={{ marginTop: 10 }}>
        Hero &amp; about.
      </Heading>
      <p style={{ fontStyle: 'italic', color: DIM, fontSize: 15, marginTop: 10, maxWidth: 560 }}>
        Choose any project image as the home hero or the about portrait, or upload a brand-new one
        — no project required. These feed the pipeline on the next rebuild.
      </p>

      {/* Shared hidden input for the hero/about "upload new" buttons. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChosen}
      />

      {error && (
        <Cap style={{ color: 'rgb(231,76,60)', display: 'block', marginTop: 14 }}>{error}</Cap>
      )}

      <div style={{ display: 'flex', gap: 40, marginTop: 28, flexWrap: 'wrap' }}>
        <div>
          <Cap style={{ color: DIM, display: 'block', marginBottom: 10 }}>Home hero</Cap>
          <ThumbPreview url={heroUrl} label="None" />
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill onClick={() => setPicking('hero_image_id')} disabled={uploading !== null}>
              {heroId ? 'Swap' : 'Choose'}
            </Pill>
            <Pill onClick={() => triggerUpload('hero_image_id')} disabled={uploading !== null}>
              {uploading === 'hero_image_id' ? 'Uploading…' : 'Upload new'}
            </Pill>
          </div>
        </div>
        <div>
          <Cap style={{ color: DIM, display: 'block', marginBottom: 10 }}>About image</Cap>
          <ThumbPreview url={aboutUrl} label="None" />
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill onClick={() => setPicking('about_image_id')} disabled={uploading !== null}>
              {aboutId ? 'Swap' : 'Choose'}
            </Pill>
            <Pill onClick={() => triggerUpload('about_image_id')} disabled={uploading !== null}>
              {uploading === 'about_image_id' ? 'Uploading…' : 'Upload new'}
            </Pill>
          </div>
        </div>
      </div>

      {picking && (
        <ImagePickerModal
          catalog={catalog}
          thumbUrls={thumbUrls}
          onPick={choose}
          onClose={() => setPicking(null)}
        />
      )}

      <Rule style={{ marginTop: 36 }} />
      <Cap style={{ color: 'rgba(245,243,238,0.35)', display: 'block', marginTop: 16 }}>
        Changes save immediately. Hit <strong style={{ color: 'rgba(245,243,238,0.6)' }}>Rebuild site →</strong> (top
        right) to publish them to the live site.
      </Cap>
    </div>
  );
}
