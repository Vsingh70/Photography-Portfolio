/**
 * Lightbox Component
 *
 * Full-screen image viewer using react-photo-view
 * Features: navigation, zoom, keyboard controls, metadata display
 */

'use client';

import React from 'react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import type { GalleryImage } from '@/types/image';
import 'react-photo-view/dist/react-photo-view.css';

interface LightboxProps {
  images: GalleryImage[];
  children: React.ReactNode;
}

/**
 * Lightbox wrapper component
 * Wraps PhotoProvider around gallery content
 */
export function Lightbox({ images, children }: LightboxProps) {
  return (
    <PhotoProvider
      speed={() => 300}
      easing={(type) =>
        type === 2
          ? 'cubic-bezier(0.36, 0, 0.66, -0.56)'
          : 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }
      maskOpacity={0.95}
      loadingElement={<LoadingSpinner />}
      toolbarRender={({ onScale, scale, rotate, onRotate, index }) => (
        <LightboxToolbar
          image={images[index]}
          onScale={onScale}
          scale={scale}
          rotate={rotate}
          onRotate={onRotate}
          currentIndex={index}
          totalImages={images.length}
        />
      )}
    >
      {children}
    </PhotoProvider>
  );
}

/**
 * Individual photo view wrapper
 */
interface LightboxImageProps {
  src: string;
  alt?: string;
  children: React.ReactElement;
}

export function LightboxImage({ src, alt, children }: LightboxImageProps) {
  return (
    <PhotoView src={src} alt={alt}>
      {children}
    </PhotoView>
  );
}

/**
 * Custom toolbar with metadata and controls
 */
interface LightboxToolbarProps {
  image: GalleryImage;
  onScale: (scale: number) => void;
  scale: number;
  rotate: number;
  onRotate: (rotate: number) => void;
  currentIndex: number;
  totalImages: number;
}

function LightboxToolbar({
  image,
  onScale,
  scale,
  rotate,
  onRotate,
  currentIndex,
  totalImages,
}: LightboxToolbarProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
      <div className="mx-auto flex max-w-7xl items-start justify-between">
        {/* Image Info */}
        <div className="flex-1 text-white">
          <h3 className="text-lg font-semibold">{image.title}</h3>
          {image.description && (
            <p className="mt-1 text-sm text-white/80">{image.description}</p>
          )}
          {image.metadata && (
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/70">
              {image.metadata.camera && <span>{image.metadata.camera}</span>}
              {image.metadata.lens && <span>{image.metadata.lens}</span>}
              {image.metadata.settings && <span>{image.metadata.settings}</span>}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="ml-4 flex items-center gap-2">
          {/* Image counter */}
          <span className="text-sm text-white/80">
            {currentIndex + 1} / {totalImages}
          </span>

          {/* Zoom out */}
          <button
            className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => onScale(scale - 0.5)}
            aria-label="Zoom out"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
              />
            </svg>
          </button>

          {/* Zoom in */}
          <button
            className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => onScale(scale + 0.5)}
            aria-label="Zoom in"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
              />
            </svg>
          </button>

          {/* Rotate */}
          <button
            className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => onRotate(rotate + 90)}
            aria-label="Rotate"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading spinner for image loading
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
    </div>
  );
}

/**
 * Custom styles for react-photo-view
 */
export function LightboxStyles() {
  return (
    <style jsx global>{`
      /* Override default react-photo-view styles */
      .PhotoView-Slider__ArrowLeft,
      .PhotoView-Slider__ArrowRight {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 0.5rem;
        width: 3rem;
        height: 3rem;
        transition: all 0.2s;
      }

      .PhotoView-Slider__ArrowLeft:hover,
      .PhotoView-Slider__ArrowRight:hover {
        background: rgba(0, 0, 0, 0.7);
        transform: scale(1.1);
      }

      /* Hide default toolbar (we use custom) */
      .PhotoView-Slider__toolbarIcon {
        display: none;
      }

      /* Mobile responsive arrows */
      @media (max-width: 768px) {
        .PhotoView-Slider__ArrowLeft,
        .PhotoView-Slider__ArrowRight {
          width: 2.5rem;
          height: 2.5rem;
        }
      }

      /* Smooth transitions */
      .PhotoView-Slider__BannerWrap {
        transition: opacity 0.3s ease;
      }
    `}</style>
  );
}
