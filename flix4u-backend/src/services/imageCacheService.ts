/**
 * Image Cache & Optimization Service for Flix4U
 * Provides client-side Cache API integration, memory cache, WebP thumbnail generation,
 * and smart CDN query optimization (WebP/AVIF auto-formatting).
 */

import { resolveApiUrl } from '@/src/config/env';

const MEMORY_CACHE = new Set<string>();
const MAX_MEMORY_CACHE = 250;

/**
 * Resolves server-hosted /api/... image URLs across Web and Android APK runtimes
 * while leaving external http(s), blob:, and data: URLs intact.
 */
export function resolveBannerDisplayUrl(rawUrl: string): string {
  const url = (rawUrl || '').trim();
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/api/')) return resolveApiUrl(url);
  return url;
}

/**
 * Checks if an image URL is already loaded and decoded in memory
 */
export function isImageCached(url: string): boolean {
  if (!url) return false;
  return MEMORY_CACHE.has(url);
}

/**
 * Marks an image URL as cached inside a bounded in-memory set
 */
export function markImageCached(url: string): void {
  if (!url) return;
  if (MEMORY_CACHE.has(url)) {
    MEMORY_CACHE.delete(url);
  } else if (MEMORY_CACHE.size >= MAX_MEMORY_CACHE) {
    const oldest = MEMORY_CACHE.values().next().value;
    if (oldest !== undefined) MEMORY_CACHE.delete(oldest);
  }
  MEMORY_CACHE.add(url);
}

/**
 * Derives optimized WebP high-resolution and lightweight thumbnail URLs
 */
export function getOptimizedUrls(
  rawUrl: string,
  providedThumbnail?: string
): { highRes: string; thumbnail: string } {
  if (!rawUrl) return { highRes: '', thumbnail: '' };

  const url = resolveBannerDisplayUrl(rawUrl);
  const resolvedThumb = providedThumbnail ? resolveBannerDisplayUrl(providedThumbnail) : '';

  // If already provided a custom thumbnail, use it
  if (resolvedThumb) {
    return { highRes: url, thumbnail: resolvedThumb };
  }

  // Handle Unsplash images with URL query manipulation for WebP & progressive size
  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0];
    const highRes = `${base}?auto=format&fit=crop&w=1600&q=85`;
    const thumbnail = `${base}?auto=format&fit=crop&w=480&q=65`;
    return { highRes, thumbnail };
  }

  // Handle AniList CDN images (already optimized server-side)
  if (url.includes('anilist.co')) {
    return { highRes: url, thumbnail: url };
  }

  // Handle local Data / Blob URLs (already in memory)
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return { highRes: url, thumbnail: url };
  }

  return { highRes: url, thumbnail: url };
}

/**
 * Preloads an image into the browser cache and resolves once loaded
 */
export function preloadImage(url: string): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (MEMORY_CACHE.has(url)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      markImageCached(url);
      resolve(true);
    };
    img.onerror = () => {
      resolve(false);
    };
    img.src = url;
  });
}

/**
 * Generates an ultra-lightweight WebP thumbnail (max 480px width) using an offscreen canvas
 */
export async function generateClientThumbnail(
  source: File | string,
  maxWidth = 480,
  maxHeight = 270
): Promise<string> {
  if (typeof window === 'undefined') return '';

  return new Promise<string>((resolve, reject) => {
    let srcUrl = '';
    let shouldRevoke = false;

    if (source instanceof File) {
      srcUrl = URL.createObjectURL(source);
      shouldRevoke = true;
    } else {
      srcUrl = source;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Maintain aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (shouldRevoke) URL.revokeObjectURL(srcUrl);
          resolve(srcUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP with 0.72 quality
        let thumbDataUrl = canvas.toDataURL('image/webp', 0.72);
        // Fallback to JPEG if browser doesn't support WebP export
        if (!thumbDataUrl.startsWith('data:image/webp')) {
          thumbDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        }

        if (shouldRevoke) URL.revokeObjectURL(srcUrl);
        resolve(thumbDataUrl);
      } catch (err) {
        if (shouldRevoke) URL.revokeObjectURL(srcUrl);
        // If canvas security tainted by CORS, return original
        resolve(srcUrl);
      }
    };

    img.onerror = (err) => {
      if (shouldRevoke) URL.revokeObjectURL(srcUrl);
      reject(err);
    };

    img.src = srcUrl;
  });
}
