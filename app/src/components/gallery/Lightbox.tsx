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
  children: React.ReactElement;
}

export function LightboxImage({ src, children }: LightboxImageProps) {
  return (
    <PhotoView src={src}>
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
      /* Override default react-photo-view styles - target all possible elements */
      .PhotoView-Slider__ArrowLeft,
      .PhotoView-Slider__ArrowRight,
      .PhotoView-Slider__ArrowLeft::before,
      .PhotoView-Slider__ArrowRight::before,
      .PhotoView-Slider__ArrowLeft::after,
      .PhotoView-Slider__ArrowRight::after {
        background: transparent !important;
        background-color: transparent !important;
        backdrop-filter: none !important;
      }

      .PhotoView-Slider__ArrowLeft,
      .PhotoView-Slider__ArrowRight {
        border-radius: 0;
        width: 2.5rem;
        height: 2.5rem;
        transition: all 0.2s;
      }

      .PhotoView-Slider__ArrowLeft:hover,
      .PhotoView-Slider__ArrowRight:hover,
      .PhotoView-Slider__ArrowLeft:hover::before,
      .PhotoView-Slider__ArrowRight:hover::before,
      .PhotoView-Slider__ArrowLeft:hover::after,
      .PhotoView-Slider__ArrowRight:hover::after {
        background: transparent !important;
        background-color: transparent !important;
        backdrop-filter: none !important;
        transform: scale(1.1);
      }

      /* Target any child elements that might have backgrounds */
      .PhotoView-Slider__ArrowLeft > *,
      .PhotoView-Slider__ArrowRight > * {
        background: transparent !important;
        background-color: transparent !important;
      }

      /* Make default toolbar fully transparent */
      .PhotoView-Slider__BannerWrap {
        background: transparent !important;
      }

      .PhotoView-Slider__toolbarIcon {
        background: transparent !important;
        background-color: transparent !important;
        backdrop-filter: none !important;
      }

      /* Mobile responsive arrows */
      @media (max-width: 768px) {
        .PhotoView-Slider__ArrowLeft,
        .PhotoView-Slider__ArrowRight {
          background: transparent !important;
          width: 2.5rem;
          height: 2.5rem;
        }
      }

      /* Smooth transitions */
      .PhotoView-Slider__toolbarWrap {
        transition: opacity 0.3s ease;
      }
    `}</style>
  );
}
