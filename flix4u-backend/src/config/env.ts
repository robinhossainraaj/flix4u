import { Capacitor } from '@capacitor/core';
import defaultAvatarImg from '@/src/assets/images/default_avatar_art_1794848733721.jpg';
import heroFallbackImg from '@/src/assets/images/hero_fallback_backdrop_1794848732685.jpg';
import posterFallbackImg from '@/src/assets/images/poster_fallback_art_1794848734095.jpg';

const DEFAULT_STREAMING_API = 'https://ashanime-api.vercel.app';
const DEFAULT_ANILIST_API = 'https://graphql.anilist.co';
const DEFAULT_BACKEND_ORIGIN = 'https://your-flix4u-backend.vercel.app';
const OVERRIDE_STORAGE_KEY = 'flix4u_api_override_v1';
const CONSUMET_OVERRIDE_STORAGE_KEY = 'flix4u_consumet_api_override_v1';

const BACKEND_OVERRIDE_STORAGE_KEY = 'flix4u_backend_api_override_v1';

export const ASSETS = {
  heroFallback: heroFallbackImg,
  posterFallback: posterFallbackImg,
  defaultAvatar: defaultAvatarImg,
};

export function isNativeCapacitorRuntime(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform && platform !== 'web') return true;
  } catch {
    // ignore Capacitor bridge absence
  }
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol;
    if (proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:') {
      return true;
    }
  }
  return false;
}

export function getDefaultBackendApiOrigin(): string {
  const configured = (import.meta.env.VITE_BACKEND_API_URL || DEFAULT_BACKEND_ORIGIN).trim();
  return configured.replace(/\/+$/, '');
}

export function getBackendApiOrigins(): string[] {
  const candidates: string[] = [];
  const push = (raw?: string | null) => {
    if (!raw) return;
    const cleaned = raw.trim().replace(/\/+$/, '');
    if (/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(cleaned) && !candidates.includes(cleaned)) {
      candidates.push(cleaned);
    }
  };

  try {
    const override = localStorage.getItem(BACKEND_OVERRIDE_STORAGE_KEY);
    if (override) push(override);
  } catch {
    // ignore storage errors
  }

  push(import.meta.env.VITE_BACKEND_API_URL);
  push(DEFAULT_BACKEND_ORIGIN);

  const fallbacksRaw = import.meta.env.VITE_BACKEND_API_FALLBACK_URLS;
  if (typeof fallbacksRaw === 'string' && fallbacksRaw.trim()) {
    for (const entry of fallbacksRaw.split(',')) {
      push(entry);
    }
  }

  return candidates;
}

export function getBackendApiOrigin(): string {
  return getBackendApiOrigins()[0] || getDefaultBackendApiOrigin();
}

export function setBackendApiOverride(url: string | null): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(BACKEND_OVERRIDE_STORAGE_KEY);
    } else {
      const cleaned = url.trim().replace(/\/+$/, '');
      if (/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(cleaned)) {
        localStorage.setItem(BACKEND_OVERRIDE_STORAGE_KEY, cleaned);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  if (isNativeCapacitorRuntime()) {
    return `${getBackendApiOrigin()}${normalizedPath}`;
  }
  return normalizedPath;
}

export function logApiDiagnostic(
  scope: string,
  url: string,
  details: { status?: number; message?: string; extra?: Record<string, unknown> }
): void {
  const originType = isNativeCapacitorRuntime() ? 'capacitor-native' : 'web';
  console.warn(`[Flix4U API][${scope}][${originType}]`, {
    url,
    status: details.status,
    message: details.message,
    ...(details.extra || {}),
  });
}

export function getAnilistApiUrl(): string {
  return import.meta.env.VITE_ANILIST_API_URL || DEFAULT_ANILIST_API;
}

export function getStreamingApiBase(): string {
  try {
    const override = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (override && override.trim().startsWith('http')) {
      return override.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore storage errors
  }
  const envUrl = import.meta.env.VITE_STREAMING_API_BASE || DEFAULT_STREAMING_API;
  return envUrl.replace(/\/+$/, '');
}

export function setStreamingApiOverride(url: string | null): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    } else {
      localStorage.setItem(OVERRIDE_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
    }
  } catch {
    // ignore storage errors
  }
}

export function getDefaultStreamingApiBase(): string {
  return (import.meta.env.VITE_STREAMING_API_BASE || DEFAULT_STREAMING_API).replace(/\/+$/, '');
}

export function getDefaultConsumetApiBase(): string {
  return (import.meta.env.VITE_CONSUMET_API_URL || '').trim().replace(/\/+$/, '');
}

export function getConsumetApiBase(): string {
  try {
    const override = localStorage.getItem(CONSUMET_OVERRIDE_STORAGE_KEY);
    if (override && override.trim().startsWith('http')) {
      return override.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore storage errors
  }
  return getDefaultConsumetApiBase();
}

export function setConsumetApiOverride(url: string | null): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(CONSUMET_OVERRIDE_STORAGE_KEY);
    } else {
      localStorage.setItem(CONSUMET_OVERRIDE_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
    }
  } catch {
    // ignore storage errors
  }
}

