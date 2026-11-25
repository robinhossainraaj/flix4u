import { logApiDiagnostic, resolveApiUrl } from '@/src/config/env';
import { authorizedApiFetch } from '@/src/services/authorizedFetch';
import { extractErrorMessage, parseSafeJsonResponse } from '@/src/utils/errorUtils';
import type {
  AniSkipResponse,
  AniZipResponse,
  ExtensionRepoItem,
  ExtensionsCatalogResponse,
} from '@/src/types/anime';

const ENABLED_EXTENSIONS_KEY = 'flix4u_enabled_extensions_v1';

const DEFAULT_ENABLED_EXTENSION_IDS = [
  'aniyomi:eu.kanade.tachiyomi.animeextension.en.zoro',
  'aniyomi:eu.kanade.tachiyomi.animeextension.en.aniwatch',
  'aniyomi:eu.kanade.tachiyomi.animeextension.en.kaido',
  'aniyomi:eu.kanade.tachiyomi.animeextension.en.animepahe',
];

async function fetchJsonWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

const EXT_CACHE_MAX = 80;
const extCache = new Map<string, { expiresAt: number; data: unknown }>();
const extInFlight = new Map<string, Promise<unknown>>();

function getCachedExt<T>(key: string): T | undefined {
  const entry = extCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    extCache.delete(key);
    return undefined;
  }
  extCache.delete(key);
  extCache.set(key, entry);
  return entry.data as T;
}

function setCachedExt(key: string, data: unknown, ttlMs: number): void {
  if (extCache.has(key)) extCache.delete(key);
  extCache.set(key, { expiresAt: Date.now() + ttlMs, data });
  while (extCache.size > EXT_CACHE_MAX) {
    const oldest = extCache.keys().next().value;
    if (oldest === undefined) break;
    extCache.delete(oldest);
  }
}

export async function fetchExtensionsCatalog(): Promise<ExtensionsCatalogResponse> {
  const key = 'extensions:catalog';
  const cached = getCachedExt<ExtensionsCatalogResponse>(key);
  if (cached) return cached;

  const existing = extInFlight.get(key);
  if (existing) return existing as Promise<ExtensionsCatalogResponse>;

  const flight = (async () => {
    const resolvedUrl = resolveApiUrl('/api/extensions/repos');
    const res = await authorizedApiFetch(resolvedUrl, { timeoutMs: 12000 });
    const parsed = await parseSafeJsonResponse<ExtensionsCatalogResponse>(res);
    if (!parsed.ok || !parsed.data) {
      const msg = extractErrorMessage(
        parsed.data || parsed.rawText,
        `Extension repository request failed (HTTP ${parsed.status}).`
      );
      logApiDiagnostic('ExtensionsCatalog', resolvedUrl, { status: parsed.status, message: msg });
      throw new Error(msg);
    }
    setCachedExt(key, parsed.data, 10 * 60 * 1000);
    return parsed.data;
  })().finally(() => {
    extInFlight.delete(key);
  });

  extInFlight.set(key, flight);
  return flight;
}

export function getEnabledExtensionIds(): string[] {
  try {
    const raw = localStorage.getItem(ENABLED_EXTENSIONS_KEY);
    if (!raw) return DEFAULT_ENABLED_EXTENSION_IDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_ENABLED_EXTENSION_IDS;
}

export function setEnabledExtensionIds(ids: string[]): void {
  try {
    localStorage.setItem(ENABLED_EXTENSIONS_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('flix4u:extensions-updated'));
  } catch {
    // ignore storage errors
  }
}

export function toggleCompatibleExtension(
  ext: ExtensionRepoItem,
  currentEnabled: string[]
): { next: string[]; error?: string } {
  if (!ext.compatible) {
    return {
      next: currentEnabled,
      error: ext.limitationReason,
    };
  }
  const exists = currentEnabled.includes(ext.id);
  const next = exists
    ? currentEnabled.filter((id) => id !== ext.id)
    : [...currentEnabled, ext.id];
  setEnabledExtensionIds(next);
  return { next };
}

export async function fetchAniZipMetadata(anilistId: number): Promise<AniZipResponse | null> {
  if (!Number.isFinite(anilistId) || anilistId <= 0) return null;
  const key = `anizip:${anilistId}`;
  const cached = getCachedExt<AniZipResponse | null>(key);
  if (cached !== undefined) return cached;

  const existing = extInFlight.get(key);
  if (existing) return existing as Promise<AniZipResponse | null>;

  const flight = (async (): Promise<AniZipResponse | null> => {
    const backendUrl = resolveApiUrl(`/api/anime/anizip/${anilistId}`);
    try {
      const res = await authorizedApiFetch(backendUrl, { timeoutMs: 8000 });
      if (res.ok) {
        const data = (await res.json()) as AniZipResponse;
        setCachedExt(key, data, 15 * 60 * 1000);
        return data;
      }
      logApiDiagnostic('AniZip', backendUrl, { status: res.status });
    } catch (err) {
      logApiDiagnostic('AniZip', backendUrl, {
        message: err instanceof Error ? err.message : 'Backend AniZip failed',
      });
    }

    // Fallback directly to AniZip CORS-enabled HTTPS API if backend proxy is unavailable
    try {
      const directRes = await fetchJsonWithTimeout(
        `https://api.ani.zip/mappings?anilist_id=${anilistId}`,
        8000
      );
      if (!directRes.ok) return null;
      const raw = (await directRes.json()) as Record<string, unknown>;
      const mappings =
        raw.mappings && typeof raw.mappings === 'object'
          ? (raw.mappings as Record<string, unknown>)
          : {};
      const episodesObj =
        raw.episodes && typeof raw.episodes === 'object'
          ? (raw.episodes as Record<string, Record<string, unknown>>)
          : {};
      const episodes: NonNullable<AniZipResponse['episodes']> = {};
      for (const [k, v] of Object.entries(episodesObj)) {
        if (!v || typeof v !== 'object') continue;
        const titleObj = v.title && typeof v.title === 'object' ? (v.title as Record<string, unknown>) : {};
        episodes[k] = {
          episodeNumber: Number(v.episodeNumber || k) || 0,
          title: String(titleObj.en || titleObj['x-jat'] || `Episode ${k}`),
          overview: typeof v.overview === 'string' ? v.overview : undefined,
          image: typeof v.image === 'string' ? v.image : null,
          airDate: typeof v.airDate === 'string' ? v.airDate : null,
          runtime: typeof v.runtime === 'number' ? v.runtime : null,
        };
      }
      const mapped: AniZipResponse = {
        found: true,
        anilistId,
        mappings: {
          malId: typeof mappings.mal_id === 'number' ? mappings.mal_id : null,
          kitsuId: typeof mappings.kitsu_id === 'number' ? mappings.kitsu_id : null,
        },
        episodeCount: Object.keys(episodes).length,
        episodes,
      };
      setCachedExt(key, mapped, 15 * 60 * 1000);
      return mapped;
    } catch {
      return null;
    }
  })().finally(() => {
    extInFlight.delete(key);
  });

  extInFlight.set(key, flight);
  return flight;
}

export async function fetchAniSkipTimestamps(
  malId: number,
  episodeNumber: number,
  episodeLength = 0
): Promise<AniSkipResponse | null> {
  if (!Number.isFinite(malId) || malId <= 0 || !Number.isFinite(episodeNumber) || episodeNumber <= 0) {
    return null;
  }
  const lenKey = Math.max(0, Math.floor(episodeLength));
  const key = `aniskip:${malId}:${episodeNumber}:${lenKey}`;
  const cached = getCachedExt<AniSkipResponse | null>(key);
  if (cached !== undefined) return cached;

  const existing = extInFlight.get(key);
  if (existing) return existing as Promise<AniSkipResponse | null>;

  const flight = (async (): Promise<AniSkipResponse | null> => {
    const backendUrl = resolveApiUrl(
      `/api/anime/skip/${malId}/${episodeNumber}?length=${lenKey}`
    );
    try {
      const res = await authorizedApiFetch(backendUrl, { timeoutMs: 6000 });
      if (res.ok) {
        const data = (await res.json()) as AniSkipResponse;
        setCachedExt(key, data, 15 * 60 * 1000);
        return data;
      }
    } catch {
      // non-fatal, fallback below
    }

    try {
      const qs = `types=op&types=ed&types=recap&episodeLength=${lenKey}`;
      const directRes = await fetchJsonWithTimeout(
        `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?${qs}`,
        6000
      );
      if (!directRes.ok) return null;
      const raw = (await directRes.json()) as {
        found?: boolean;
        results?: Array<{ skipType?: string; interval?: { startTime?: number; endTime?: number } }>;
      };
      const skipTimes = (raw.results || [])
        .filter(
          (r) =>
            r.interval &&
            typeof r.interval.startTime === 'number' &&
            typeof r.interval.endTime === 'number'
        )
        .map((r) => ({
          type: (r.skipType === 'op' ? 'op' : r.skipType === 'ed' ? 'ed' : 'recap') as
            | 'op'
            | 'ed'
            | 'recap',
          start: Number(r.interval?.startTime || 0),
          end: Number(r.interval?.endTime || 0),
          source: 'aniskip' as const,
        }));
      const intro = skipTimes.find((t) => t.type === 'op');
      const outro = skipTimes.find((t) => t.type === 'ed');
      const recap = skipTimes.find((t) => t.type === 'recap');
      const mapped: AniSkipResponse = {
        found: Boolean(raw.found && skipTimes.length > 0),
        malId,
        episodeNumber,
        intro,
        outro,
        recap,
        skipTimes,
      };
      setCachedExt(key, mapped, 15 * 60 * 1000);
      return mapped;
    } catch {
      return null;
    }
  })().finally(() => {
    extInFlight.delete(key);
  });

  extInFlight.set(key, flight);
  return flight;
}
