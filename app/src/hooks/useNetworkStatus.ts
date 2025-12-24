/**
 * Network Status Hook
 *
 * Detects network connection quality and adapts image loading strategy
 */

'use client';

import { useEffect, useState } from 'react';

export type NetworkQuality = 'high' | 'medium' | 'low' | 'offline';

interface NetworkStatus {
  quality: NetworkQuality;
  effectiveType: string;
  downlink: number;
  saveData: boolean;
}

/**
 * Hook to detect network connection quality
 * Adapts image loading based on connection speed
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    quality: 'high',
    effectiveType: '4g',
    downlink: 10,
    saveData: false,
  });

  useEffect(() => {
    // Check if Network Information API is available
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    const updateNetworkStatus = () => {
      if (!connection) {
        // Default to high quality if API not available
        setNetworkStatus({
          quality: 'high',
          effectiveType: '4g',
          downlink: 10,
          saveData: false,
        });
        return;
      }

      const effectiveType = connection.effectiveType || '4g';
      const downlink = connection.downlink || 10;
      const saveData = connection.saveData || false;

      // Determine quality based on effective connection type and downlink
      let quality: NetworkQuality = 'high';

      if (!navigator.onLine) {
        quality = 'offline';
      } else if (saveData) {
        // User has enabled data saver mode
        quality = 'low';
      } else if (effectiveType === '4g' && downlink > 5) {
        quality = 'high';
      } else if (effectiveType === '4g' || effectiveType === '3g') {
        quality = 'medium';
      } else {
        // 2g or slow-2g
        quality = 'low';
      }

      setNetworkStatus({
        quality,
        effectiveType,
        downlink,
        saveData,
      });
    };

    // Initial check
    updateNetworkStatus();

    // Listen for network changes
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  return networkStatus;
}

/**
 * Get recommended thumbnail size based on network quality
 */
export function getRecommendedThumbnailSize(quality: NetworkQuality): number {
  switch (quality) {
    case 'high':
      return 600; // Higher quality for fast connections
    case 'medium':
      return 400; // Standard quality
    case 'low':
      return 200; // Lower quality for slow connections
    case 'offline':
      return 0; // Don't load new images
    default:
      return 400;
  }
}

/**
 * Determine if preloading should be enabled
 */
export function shouldPreload(quality: NetworkQuality): boolean {
  return quality === 'high';
}
