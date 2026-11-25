import { logApiDiagnostic, resolveApiUrl } from '@/src/config/env';
import { authorizedApiFetch } from '@/src/services/authorizedFetch';
import { parseWatchResponse } from '@/src/services/streamingApi';
import {
  extractErrorDetails,
  extractErrorMessage,
  isPlayableStreamUrl,
  parseSafeJsonResponse,
} from '@/src/utils/errorUtils';
import type {
  AnimeWorldEpisode,
  AnimeWorldItem,
  AnimeWorldSeason,
  AnimeWorldStreamResponse,
  MediaFormat,
  ParsedStreamResult,
  StreamFetchError,
  StreamSource,
} from '@/src/types/anime';

const AW_BASE = '/api/anime-world-india/v1';

export interface AnimeWorldHomeResponse {
  success: boolean;
  source: string;
  latest_series: AnimeWorldItem[];
  latest_movies: AnimeWorldItem[];
  error?: string;
}

export interface AnimeWorldSeriesListResponse {
  success: boolean;
  source: string;
  current_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  pages: number[];
  total_results: number;
  series: AnimeWorldItem[];
  error?: string;
}

export interface AnimeWorldSearchResponse {
  success: boolean;
  query: string;
  currentPage?: number;
  current_page?: number;
  total_pages?: number;
  has_next?: boolean;
  has_prev?: boolean;
  pages?: number[];
  total_results?: number;
  source: string;
  results: AnimeWorldItem[];
  error?: string;
}

export interface AnimeWorldMoviesListResponse {
  success: boolean;
  source: string;
  current_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  pages: number[];
  total_results: number;
  movies: AnimeWorldItem[];
  error?: string;
}

export interface AnimeWorldA2ZResponse {
  success: boolean;
  letter: string;
  source: string;
  current_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  pages: number[];
  total_results: number;
  results: AnimeWorldItem[];
  error?: string;
}

export interface AnimeWorldSeasonsResponse {
  success: boolean;
  source: string;
  series: {
    seriesId: string;
    title: string;
    poster: string | null;
    proxyPoster?: string | null;
    banner?: string | null;
    proxyBanner?: string | null;
    year: string | null;
    rating?: string | null;
    totalSeasons: string;
    totalEpisodes?: string;
    languages: string[];
    genres?: string[];
    description: string | null;
  };
  seasons: AnimeWorldSeason[];
  error?: string;
}

export interface AnimeWorldEpisodesResponse {
  success: boolean;
  source: string;
  season: {
    seasonId: string;
    animeTitle: string;
    seasonName: string;
    totalEpisodes: string;
  };
  episodes: AnimeWorldEpisode[];
  error?: string;
}

interface AwCacheEntry<T> {
  data: T;
  expiresAt: number;
}

const AW_CACHE_MAX = 80;
const awMemoryCache = new Map<string, AwCacheEntry<unknown>>();
const awInFlight = new Map<string, Promise<unknown>>();
const AW_HOME_SNAPSHOT_KEY = 'kuro_aw_home_v1';
const AW_SERIES1_SNAPSHOT_KEY = 'kuro_aw_series1_v1';

function readAwCache<T>(key: string): T | null {
  const entry = awMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    awMemoryCache.delete(key);
    return null;
  }
  awMemoryCache.delete(key);
  awMemoryCache.set(key, entry);
  return entry.data as T;
}

function writeAwCache<T>(key: string, data: T, ttlMs: number): void {
  if (awMemoryCache.has(key)) {
    awMemoryCache.delete(key);
  } else if (awMemoryCache.size >= AW_CACHE_MAX) {
    const oldest = awMemoryCache.keys().next().value;
    if (oldest !== undefined) awMemoryCache.delete(oldest);
  }
  awMemoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function readSessionSnapshot<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AwCacheEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionSnapshot<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + ttlMs }));
  } catch {
    // Ignore storage quota errors
  }
}

export function peekAnimeWorldHomeSnapshot(): {
  home: AnimeWorldHomeResponse | null;
  seriesPage1: AnimeWorldSeriesListResponse | null;
} {
  const memHome = readAwCache<AnimeWorldHomeResponse>('aw:home');
  const memSeries1 = readAwCache<AnimeWorldSeriesListResponse>('aw:series:1');
  const home = memHome || readSessionSnapshot<AnimeWorldHomeResponse>(AW_HOME_SNAPSHOT_KEY);
  const seriesPage1 =
    memSeries1 || readSessionSnapshot<AnimeWorldSeriesListResponse>(AW_SERIES1_SNAPSHOT_KEY);
  if (home && !memHome) writeAwCache('aw:home', home, 120_000);
  if (seriesPage1 && !memSeries1) writeAwCache('aw:series:1', seriesPage1, 120_000);
  return { home, seriesPage1 };
}

async function withAwCachedDedup<T>(
  cacheKey: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  shouldCache: (val: T) => boolean = () => true
): Promise<T> {
  const cached = readAwCache<T>(cacheKey);
  if (cached !== null) return cached;

  const existing = awInFlight.get(cacheKey);
  if (existing) return existing as Promise<T>;

  const task = fetcher()
    .then((res) => {
      if (shouldCache(res)) {
        writeAwCache(cacheKey, res, ttlMs);
      }
      return res;
    })
    .finally(() => {
      awInFlight.delete(cacheKey);
    });

  awInFlight.set(cacheKey, task);
  return task;
}

export function buildAnimeWorldProxyImageUrl(
  rawUrl?: string | null,
  explicitProxyPath?: string | null
): string | null {
  if (explicitProxyPath && explicitProxyPath.trim()) {
    return resolveApiUrl(explicitProxyPath.trim());
  }
  if (!rawUrl || !rawUrl.trim()) return null;
  const cleaned = rawUrl.trim().startsWith('//') ? `https:${rawUrl.trim()}` : rawUrl.trim();
  if (!/^https?:\/\//i.test(cleaned)) return null;
  try {
    const host = new URL(cleaned).hostname.toLowerCase();
    const isAwImgHost =
      host === 'image.tmdb.org' ||
      host.endsWith('.tmdb.org') ||
      host === 'animesky.app' ||
      host.endsWith('.animesky.app') ||
      host === 'animesalt.cx' ||
      host.endsWith('.animesalt.cx') ||
      /^i[0-3]\.wp\.com$/i.test(host) ||
      /^as-cdn\d+\.top$/i.test(host);
    if (!isAwImgHost) return null;
    return resolveApiUrl(`${AW_BASE}/image.php?url=${encodeURIComponent(cleaned)}`);
  } catch {
    return null;
  }
}

async function fetchAwWithTimeout(
  endpointUrl: string,
  timeoutMs = 18000,
  signal?: AbortSignal
): Promise<{
  resolvedUrl: string;
  res: Response;
}> {
  const resolvedUrl = resolveApiUrl(endpointUrl);
  const res = await authorizedApiFetch(resolvedUrl, { timeoutMs, retries: 1, signal });
  return { resolvedUrl, res };
}

export function isGenuineMediaDownloadUrl(rawUrl?: string | null): rawUrl is string {
  if (!rawUrl || !isPlayableStreamUrl(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'https://flix4u.local');
    const host = parsed.hostname.toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();
    const fullLower = rawUrl.toLowerCase();
    if (
      host.includes('ravok.buzz') ||
      host.includes('abyssplayer.com') ||
      host.includes('megaplay.buzz') ||
      fullLower.includes('multi-lang-plyr') ||
      pathLower.includes('/embed') ||
      pathLower.includes('/video/')
    ) {
      return false;
    }
    return /\.(mp4|mkv|webm|m3u8)(\?|$)/i.test(fullLower);
  } catch {
    return false;
  }
}

export async function fetchAnimeWorldHome(): Promise<AnimeWorldHomeResponse> {
  return withAwCachedDedup('aw:home', 120_000, async () => {
    const endpoint = `${AW_BASE}/home.php`;
    const { resolvedUrl, res } = await fetchAwWithTimeout(endpoint);
    const parsed = await parseSafeJsonResponse<AnimeWorldHomeResponse>(res);
    if (!parsed.ok || !parsed.data || parsed.data.success === false) {
      const msg = extractErrorMessage(
        parsed.data || parsed.rawText,
        `AnimeWorld India homepage returned HTTP ${parsed.status}`
      );
      logApiDiagnostic('AnimeWorldHome', resolvedUrl, { status: parsed.status, message: msg });
      throw new Error(msg);
    }
    writeSessionSnapshot(AW_HOME_SNAPSHOT_KEY, parsed.data, 120_000);
    return parsed.data;
  });
}

export async function fetchAnimeWorldSeries(page = 1): Promise<AnimeWorldSeriesListResponse> {
  return withAwCachedDedup(`aw:series:${page}`, 120_000, async () => {
    const endpoint = `${AW_BASE}/series.php?p=${encodeURIComponent(String(page))}`;
    const { resolvedUrl, res } = await fetchAwWithTimeout(endpoint);
    const parsed = await parseSafeJsonResponse<AnimeWorldSeriesListResponse>(res);
    if (!parsed.ok || !parsed.data || parsed.data.success === false) {
      const msg = extractErrorMessage(
        parsed.data || parsed.rawText,
        `AnimeWorld India series list returned HTTP ${parsed.status}`
      );
      logApiDiagnostic('AnimeWorldSeries', resolvedUrl, { status: parsed.status, message: msg });
      throw new Error(msg);
    }
    if (page === 1) {
      writeSessionSnapshot(AW_SERIES1_SNAPSHOT_KEY, parsed.data, 120_000);
    }
    return parsed.data;
  });
}

export async function fetchAnimeWorldMovies(page = 1): Promise<AnimeWorldMoviesListResponse> {
  return withAwCachedDedup(`aw:movies:${page}`, 120_000, async () => {
    const endpoint = `${AW_BASE}/movie.php?p=${encodeURIComponent(String(page))}`;
    const { resolvedUrl, res } = await fetchAwWithTimeout(endpoint);
    const parsed = await parseSafeJsonResponse<AnimeWorldMoviesListResponse>(res);
    if (!parsed.ok || !parsed.data || parsed.data.success === false) {
      const msg = extractErrorMessage(
        parsed.data || parsed.rawText,
        `AnimeWorld India movies list returned HTTP ${parsed.status}`
      );
      logApiDiagnostic('AnimeWorldMovies', resolvedUrl, { status: parsed.status, message: msg });
      throw new Error(msg);
    }
    return parsed.data;
  });
}

export async function fetchAnimeWorldA2Z(
  letter = 'A',
  page = 1
): Promise<AnimeWorldA2ZResponse> {
  return withAwCachedDedup(`aw:a2z:${letter.toUpperCase()}:${page}`, 180_000, async () => {
    const endpoint = `${AW_BASE}/a2z.php?letter=${encodeURIComponent(letter)}&p=${encodeURIComponent(String(page))}`;
    const { resolvedUrl, res } = await fetchAwWithTimeout(endpoint);
    const parsed = await parseSafeJsonResponse<AnimeWorldA2ZResponse>(res);
    if (!parsed.ok || !parsed.data || parsed.data.success === false) {
      const msg = extractErrorMessage(
        parsed.data || parsed.rawText,
        `AnimeWorld India A-Z catalog returned HTTP ${parsed.status}`
      );
      logApiDiagnostic('AnimeWorldA2Z', resolvedUrl, { status: parsed.status, message: msg });
      throw new Error(msg);
    }
    return parsed.data;
  });
}

export async function searchAnimeWorld(
  query: string,
  page = 1,
  options?: { signal?: AbortSignal }
): Promise<AnimeWorldSearchResponse> {
  const cacheKey = `aw:search:${query.trim().toLowerCase()}:${page}`;
  const cached = readAwCache<AnimeWorldSearchResponse>(cacheKey);
  if (cached !== null) return cached;

  const endpoint = `${AW_BASE}/search.php?query=${encodeURIComponent(query)}&p=${encodeURIComponent(String(page))}`;
  const runSearch = async () => {
    const { resolvedUrl, res } = await fetchAwWithTimeout(endpoint, 15000, options?.signal);
    const parsed = await parseSafeJsonResponse<AnimeWorldSearchResponse>(res);
    if (!parsed.ok || !parsed.data || parsed.data.success === false) {
      const details = extractErrorDetails(
        parsed.data || parsed.rawText,
        resolvedUrl,
        parsed.status,
        `AnimeWorld India search returned HTTP ${parsed.status}`
      );
      logApiDiagnostic('AnimeWorldSearch', resolvedUrl, {
        status: parsed.status,
        message: details.message,
      });
      const err = new Error(details.message) as Error & {
        statusCode?: number;
        detail?: string;
        response?: { status: number; data: unknown };
      };
      err.statusCode = details.statusCode || parsed.status || 502;
      err.detail = details.detail;
      err.response = { status: parsed.status, data: parsed.data || parsed.rawText };
      throw err;
    }
    writeAwCache(cacheKey, parsed.data, 90_000);
    return parsed.data;
  };

  if (options?.signal) {
    return runSearch();
  }
  const existing = awInFlight.get(cacheKey);
  if (existing) return existing as Promise<AnimeWorldSearchResponse>;
  const task = runSearch().finally(() => {
    awInFlight.delete(cacheKey);
  });
  awInFlight.set(cacheKey, task);
  return task;
}

export async function fetchAnimeWorldSeasons(
  seriesID: string
): Promise<{ status: number; data: AnimeWorldSeasonsResponse | null; rawText?: string; endpointUrl: string }> {
  return withAwCachedDedup(
    `aw:seasons:${seriesID}`,
    180_000,
    async () => {
      const endpointUrl = `${AW_BASE}/seasons.php?seriesID=${encodeURIComponent(seriesID)}`;
      const { resolvedUrl, res } = await fetchAwWithTimeout(endpointUrl);
      const parsed = await parseSafeJsonResponse<AnimeWorldSeasonsResponse>(res);
      if (!parsed.ok) {
        logApiDiagnostic('AnimeWorldSeasons', resolvedUrl, { status: parsed.status });
      }
      return { status: parsed.status, data: parsed.data, rawText: parsed.rawText, endpointUrl: resolvedUrl };
    },
    (res) => res.status >= 200 && res.status < 300 && res.data?.success !== false
  );
}

export async function fetchAnimeWorldEpisodes(
  seasonId: string
): Promise<{ status: number; data: AnimeWorldEpisodesResponse | null; rawText?: string; endpointUrl: string }> {
  return withAwCachedDedup(
    `aw:episodes:${seasonId}`,
    180_000,
    async () => {
      const endpointUrl = `${AW_BASE}/episodes.php?seasonId=${encodeURIComponent(seasonId)}`;
      const { resolvedUrl, res } = await fetchAwWithTimeout(endpointUrl);
      const parsed = await parseSafeJsonResponse<AnimeWorldEpisodesResponse>(res);
      if (!parsed.ok) {
        logApiDiagnostic('AnimeWorldEpisodes', resolvedUrl, { status: parsed.status });
      }
      return { status: parsed.status, data: parsed.data, rawText: parsed.rawText, endpointUrl: resolvedUrl };
    },
    (res) => res.status >= 200 && res.status < 300 && res.data?.success !== false
  );
}

export async function fetchAnimeWorldStream(params: {
  episodeId?: string;
  movieId?: string;
  lang?: 'hindi' | 'sub' | 'dub' | string;
}): Promise<{ status: number; data: AnimeWorldStreamResponse | null; rawText?: string; endpointUrl: string }> {
  const qp = new URLSearchParams();
  if (params.episodeId) {
    qp.set('episodeId', params.episodeId);
  } else {
    qp.set('movieId', params.movieId || '');
  }
  if (params.lang) {
    qp.set('lang', params.lang);
  }
  const endpointUrl = `${AW_BASE}/stream.php?${qp.toString()}`;
  const { resolvedUrl, res } = await fetchAwWithTimeout(endpointUrl);
  const parsed = await parseSafeJsonResponse<AnimeWorldStreamResponse>(res);
  if (!parsed.ok) {
    logApiDiagnostic('AnimeWorldStream', resolvedUrl, { status: parsed.status });
  }
  return { status: parsed.status, data: parsed.data, rawText: parsed.rawText, endpointUrl: resolvedUrl };
}

export function parseAnimeWorldStreamToResult(
  payload: AnimeWorldStreamResponse,
  endpointUrl: string,
  requestedLang: 'hindi' | 'sub' | 'dub' = 'hindi'
): { data?: ParsedStreamResult; error?: StreamFetchError } {
  const parsed = parseWatchResponse(payload);
  const candidateSources: StreamSource[] = [];
  const seenUrls = new Set<string>();

  const pushSource = (src: StreamSource) => {
    if (!isPlayableStreamUrl(src.url) || seenUrls.has(src.url)) return;
    seenUrls.add(src.url);
    const lowerUrl = src.url.toLowerCase();
    const isDirectM3u8 =
      lowerUrl.includes('.m3u8') && !lowerUrl.includes('/video/') && !lowerUrl.includes('/embed');
    candidateSources.push(
      isDirectM3u8
        ? { ...src, type: 'hls', isM3U8: true }
        : src
    );
  };

  // Preserve primary streamLink first if present, then additional mirrors
  if (payload.stream?.streamLink && isPlayableStreamUrl(payload.stream.streamLink)) {
    const primaryUrl = payload.stream.streamLink;
    const primaryType =
      payload.stream.type ||
      (primaryUrl.toLowerCase().includes('.m3u8')
        ? 'hls'
        : /\.(mp4|mkv|webm)(\?|$)/i.test(primaryUrl)
          ? 'mp4'
          : 'embed');
    const matchingStream = (payload.streams || []).find((s) => s.url === primaryUrl);
    pushSource({
      url: primaryUrl,
      quality:
        matchingStream?.label ||
        (payload.hasHindiAudio ? 'AnimeWorld India · Hindi Audio' : 'AnimeWorld India · Stream'),
      type: primaryType,
      isM3U8: primaryType === 'hls',
      language:
        matchingStream?.language ||
        (payload.hasHindiAudio ? 'Hindi' : payload.audioLanguages?.[0]),
    });
  }

  for (const src of parsed.sources) {
    pushSource(src);
  }

  if (candidateSources.length === 0) {
    return {
      error: {
        statusCode: 404,
        endpointUrl,
        message: 'AnimeWorld India returned no playable streamLink for this title.',
      },
    };
  }

  const detectedLanguages = payload.audioLanguages || parsed.audioLanguages || [];
  const hasHindiAudio =
    Boolean(payload.hasHindiAudio) ||
    detectedLanguages.some((l) => l.toLowerCase().includes('hindi') || l.toLowerCase() === 'hin');
  const validatedDownload = isGenuineMediaDownloadUrl(payload.stream?.file)
    ? payload.stream.file
    : isGenuineMediaDownloadUrl(parsed.downloadUrl)
      ? parsed.downloadUrl
      : undefined;

  return {
    data: {
      ...parsed,
      sources: candidateSources,
      downloadUrl: validatedDownload,
      hasHindiAudio,
      audioLanguages: detectedLanguages,
      requestedLanguage: requestedLang,
      providerSource: payload.source || endpointUrl,
      servers: [{ name: 'animeworld-india' }],
    },
  };
}

function normalizeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/shippuuden/g, 'shippuden')
    .replace(/shin[\s-]*chan/g, 'shinchan')
    .replace(/kimetsu no yaiba/g, 'demon slayer')
    .replace(/shingeki no kyojin/g, 'attack on titan')
    .replace(/boku no hero academia/g, 'my hero academia')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSeasonSuffix(raw: string): string {
  return raw
    .replace(/:\s*(the\s+)?final\s+season.*$/i, '')
    .replace(/\s*[-–:]\s*season\s*\d+.*$/i, '')
    .replace(/\s+season\s*\d+.*$/i, '')
    .replace(/\s+\d+(?:st|nd|rd|th)\s+season.*$/i, '')
    .replace(/\s+part\s*\d+.*$/i, '')
    .replace(/:\s*(entertainment district|swordsmith village|hashira training|mugen train|shibuya incident|hidden inventory).*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTargetSeasonNumber(titles: Array<string | null | undefined>): number {
  const combined = titles.filter(Boolean).join(' ');
  const sMatch =
    combined.match(/season\s*(\d+)/i) ||
    combined.match(/(\d+)(?:st|nd|rd|th)\s*season/i);
  if (sMatch) return Number(sMatch[1]);

  if (/entertainment district/i.test(combined)) return 2;
  if (/swordsmith village/i.test(combined)) return 3;
  if (/hashira training/i.test(combined)) return 4;
  if (/final season/i.test(combined)) return 4;

  return 1;
}

function buildSearchQueries(
  englishTitle?: string | null,
  romajiTitle?: string | null
): string[] {
  const candidates: string[] = [];
  const add = (q?: string | null) => {
    if (!q) return;
    const clean = q
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/shippuuden/gi, 'Shippuden')
      .trim();
    if (clean.length >= 2 && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  if (englishTitle) {
    add(stripSeasonSuffix(englishTitle));
    add(englishTitle);
    const colonHead = englishTitle.split(':')[0]?.trim();
    if (colonHead && colonHead.length >= 3) add(colonHead);
  }

  if (romajiTitle) {
    add(stripSeasonSuffix(romajiTitle));
    add(romajiTitle);
    const colonHead = romajiTitle.split(':')[0]?.trim();
    if (colonHead && colonHead.length >= 3) add(colonHead);
  }

  // Friendly fallback for hyphenated titles like "Crayon Shin-chan"
  for (const existing of [...candidates]) {
    if (existing.toLowerCase().includes('shin-chan')) add('Shinchan');
  }

  return candidates.slice(0, 4);
}

function scoreSearchItem(
  item: AnimeWorldItem,
  targetTitles: string[],
  isMovie: boolean,
  seasonYear?: number | null
): number {
  const itemNorm = normalizeText(item.title);
  if (!itemNorm) return 0;

  let bestTitleScore = 0;
  for (const rawTarget of targetTitles) {
    const targetNorm = normalizeText(rawTarget);
    const strippedTargetNorm = normalizeText(stripSeasonSuffix(rawTarget));
    if (!targetNorm) continue;

    if (itemNorm === targetNorm || (strippedTargetNorm && itemNorm === strippedTargetNorm)) {
      bestTitleScore = Math.max(bestTitleScore, 100);
      continue;
    }

    if (
      itemNorm.includes(targetNorm) ||
      targetNorm.includes(itemNorm) ||
      (strippedTargetNorm &&
        (itemNorm.includes(strippedTargetNorm) || strippedTargetNorm.includes(itemNorm)))
    ) {
      bestTitleScore = Math.max(bestTitleScore, 65);
    }

    const base = strippedTargetNorm || targetNorm;
    const tTokens = base.split(' ').filter((t) => t.length > 1);
    const iTokens = new Set(itemNorm.split(' ').filter((t) => t.length > 1));
    if (tTokens.length > 0) {
      const matches = tTokens.filter((t) => iTokens.has(t)).length;
      const ratio = matches / Math.max(tTokens.length, iTokens.size);
      bestTitleScore = Math.max(bestTitleScore, Math.round(ratio * 70));
    }
  }

  if (bestTitleScore < 20) return bestTitleScore;

  let total = bestTitleScore;
  if (isMovie) {
    total += item.movieId ? 30 : -15;
  } else {
    total += item.seriesId ? 30 : -20;
  }

  if (seasonYear && item.year && item.year === String(seasonYear)) {
    total += 8;
  }

  return total;
}

function parseEpisodeRange(text: string): { start: number; end: number } | null {
  const rangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!rangeMatch) return null;
  const start = Number(rangeMatch[1]);
  const end = Number(rangeMatch[2]);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return { start, end };
  }
  return null;
}

function parseEpisodeNumberFromItem(ep: AnimeWorldEpisode): number | null {
  const fromLabel = ep.episodeNumber?.match(/(\d+)/);
  if (fromLabel) return Number(fromLabel[1]);
  const fromId = ep.episodeId?.match(/\d+x(\d+)/i) || ep.episodeId?.match(/episode[-_]?(\d+)/i);
  if (fromId) return Number(fromId[1]);
  return null;
}

function selectBestSeason(
  seasons: AnimeWorldSeason[],
  targetSeasonNum: number,
  episodeNumber: number,
  preferHindi: boolean
): AnimeWorldSeason | undefined {
  if (seasons.length === 0) return undefined;

  // 1. Check if any season explicitly lists an episode range covering episodeNumber (e.g., "33-53 (21)")
  const rangeMatches = seasons.filter((s) => {
    const range = parseEpisodeRange(s.episodes || '');
    return range ? episodeNumber >= range.start && episodeNumber <= range.end : false;
  });

  if (rangeMatches.length > 0) {
    if (preferHindi) {
      const hindiMatch = rangeMatches.find((s) => !s.isSubOnly);
      if (hindiMatch) return hindiMatch;
    }
    return rangeMatches[0];
  }

  // 2. Otherwise match by seasonNumber
  const bySeasonNum = seasons.filter((s) => Number(s.seasonNumber) === targetSeasonNum);
  if (bySeasonNum.length > 0) {
    if (preferHindi) {
      const hindiMatch = bySeasonNum.find((s) => !s.isSubOnly);
      if (hindiMatch) return hindiMatch;
    }
    return bySeasonNum[0];
  }

  // 3. Fallback to first dubbed season or first season
  if (preferHindi) {
    const firstHindi = seasons.find((s) => !s.isSubOnly);
    if (firstHindi) return firstHindi;
  }
  return seasons[0];
}

function selectBestEpisode(
  episodes: AnimeWorldEpisode[],
  episodeNumber: number
): AnimeWorldEpisode | undefined {
  if (episodes.length === 0) return undefined;

  const exactMatch = episodes.find((ep) => parseEpisodeNumberFromItem(ep) === episodeNumber);
  if (exactMatch) return exactMatch;

  // When an AniList Season 2 entry restarts at Episode 1 while AnimeWorld uses cumulative numbers (e.g. ep 27..49),
  // map relative 1-based episode index if it fits cleanly within the season
  if (episodeNumber >= 1 && episodeNumber <= episodes.length) {
    const sorted = [...episodes].sort((a, b) => {
      const na = parseEpisodeNumberFromItem(a) ?? 0;
      const nb = parseEpisodeNumberFromItem(b) ?? 0;
      return na - nb;
    });
    return sorted[episodeNumber - 1];
  }

  return undefined;
}

export async function resolveAnimeWorldStreamForAnime(options: {
  title?: string | null;
  romajiTitle?: string | null;
  format?: MediaFormat | null;
  seasonYear?: number | null;
  episodeNumber: number;
  preferHindi?: boolean;
  preferLang?: 'hindi' | 'sub' | 'dub';
}): Promise<{ data?: ParsedStreamResult; error?: StreamFetchError }> {
  const { title, romajiTitle, format, seasonYear, episodeNumber, preferHindi = true, preferLang } = options;
  const effectiveLang: 'hindi' | 'sub' | 'dub' = preferLang || (preferHindi ? 'hindi' : 'sub');
  const wantHindi = effectiveLang === 'hindi';
  const queries = buildSearchQueries(title, romajiTitle);
  const targetTitles = [title, romajiTitle].filter((t): t is string => Boolean(t && t.trim()));
  const isMovie = format === 'MOVIE';

  if (queries.length === 0) {
    return {
      error: {
        statusCode: 400,
        endpointUrl: `${AW_BASE}/search.php`,
        message: 'Anime title is missing; cannot query AnimeWorld India.',
      },
    };
  }

  let bestItem: AnimeWorldItem | null = null;
  let bestScore = 0;
  let lastSearchUrl = `${AW_BASE}/search.php?query=${encodeURIComponent(queries[0])}`;

  try {
    for (const q of queries) {
      lastSearchUrl = `${AW_BASE}/search.php?query=${encodeURIComponent(q)}`;
      const searchRes = await searchAnimeWorld(q, 1);
      for (const item of searchRes.results || []) {
        const s = scoreSearchItem(item, targetTitles, isMovie, seasonYear);
        if (s > bestScore) {
          bestScore = s;
          bestItem = item;
        }
      }
      if (!isMovie && (searchRes.results?.length || 0) >= 10 && (!bestItem?.seriesId || bestScore < 85)) {
        const page2Res = await searchAnimeWorld(q, 2).catch(() => null);
        for (const item of page2Res?.results || []) {
          const s = scoreSearchItem(item, targetTitles, isMovie, seasonYear);
          if (s > bestScore) {
            bestScore = s;
            bestItem = item;
          }
        }
      }
      if (bestScore >= 95 && (isMovie || Boolean(bestItem?.seriesId))) break;
    }
  } catch (err) {
    const extracted = extractErrorDetails(
      err,
      lastSearchUrl,
      undefined,
      'Unable to reach AnimeWorld India search API.'
    );
    const msg = extracted.message.toLowerCase().includes('animeworld')
      ? extracted.message
      : `AnimeWorld India search failed: ${extracted.message}`;
    return {
      error: {
        statusCode: extracted.statusCode || 502,
        endpointUrl: lastSearchUrl,
        message: msg,
        detail: extracted.detail,
      },
    };
  }

  if (!bestItem || bestScore < 25) {
    return {
      error: {
        statusCode: 404,
        endpointUrl: lastSearchUrl,
        message: `"${title || romajiTitle}" was not found on AnimeWorld India (HTTP 404). Switch to Vidstreaming or Megacloud for SUB/DUB playback.`,
      },
    };
  }

  let streamStatus = 404;
  let streamEndpoint = '';
  let streamPayload: AnimeWorldStreamResponse | null = null;
  let streamRawText = '';

  if (bestItem.movieId && (isMovie || !bestItem.seriesId)) {
    const res = await fetchAnimeWorldStream({ movieId: bestItem.movieId, lang: effectiveLang });
    streamStatus = res.status;
    streamEndpoint = res.endpointUrl;
    streamPayload = res.data;
    streamRawText = res.rawText || '';
  } else if (bestItem.seriesId) {
    const seasonsRes = await fetchAnimeWorldSeasons(bestItem.seriesId);
    if (seasonsRes.status >= 400 || !seasonsRes.data?.success || seasonsRes.data.seasons.length === 0) {
      return {
        error: extractErrorDetails(
          seasonsRes.data || seasonsRes.rawText,
          seasonsRes.endpointUrl,
          seasonsRes.status || 404,
          `AnimeWorld India seasons API returned HTTP ${seasonsRes.status || 404} for "${bestItem.title}".`
        ),
      };
    }

    const targetSeasonNum = extractTargetSeasonNumber([title, romajiTitle]);
    const matchedSeason = selectBestSeason(
      seasonsRes.data.seasons,
      targetSeasonNum,
      episodeNumber,
      wantHindi
    );

    if (!matchedSeason) {
      return {
        error: {
          statusCode: 404,
          endpointUrl: seasonsRes.endpointUrl,
          message: `No matching season found on AnimeWorld India for Episode ${episodeNumber}.`,
        },
      };
    }

    const episodesRes = await fetchAnimeWorldEpisodes(matchedSeason.seasonId);
    if (episodesRes.status >= 400 || !episodesRes.data?.success) {
      return {
        error: extractErrorDetails(
          episodesRes.data || episodesRes.rawText,
          episodesRes.endpointUrl,
          episodesRes.status || 404,
          `AnimeWorld India episodes API returned HTTP ${episodesRes.status || 404}.`
        ),
      };
    }

    const matchedEpisode = selectBestEpisode(episodesRes.data.episodes, episodeNumber);
    if (!matchedEpisode) {
      return {
        error: {
          statusCode: 404,
          endpointUrl: episodesRes.endpointUrl,
          message: `Episode ${episodeNumber} is not available on AnimeWorld India (HTTP 404). Try Vidstreaming or Megacloud below.`,
        },
      };
    }

    const res = await fetchAnimeWorldStream({
      episodeId: matchedEpisode.episodeId,
      lang: effectiveLang,
    });
    streamStatus = res.status;
    streamEndpoint = res.endpointUrl;
    streamPayload = res.data;
    streamRawText = res.rawText || '';
  } else {
    return {
      error: {
        statusCode: 404,
        endpointUrl: lastSearchUrl,
        message: 'AnimeWorld India returned no valid seriesId or movieId.',
      },
    };
  }

  if (streamStatus >= 400 || !streamPayload?.success) {
    return {
      error: extractErrorDetails(
        streamPayload || streamRawText,
        streamEndpoint,
        streamStatus || 404,
        `AnimeWorld India API returned HTTP ${streamStatus || 404}`
      ),
    };
  }

  const parsed = parseWatchResponse(streamPayload);

  // Ensure streams from AnimeWorld India have clean labels, valid URLs & embed classification
  const candidateSources: StreamSource[] =
    parsed.sources.length > 0
      ? parsed.sources
      : streamPayload.stream?.streamLink
        ? [
            {
              url: streamPayload.stream.streamLink,
              quality: streamPayload.hasHindiAudio
                ? 'AnimeWorld India · Hindi Audio'
                : 'AnimeWorld India · Stream',
              type: streamPayload.stream.type || 'embed',
              isM3U8: streamPayload.stream.type === 'hls',
              language: streamPayload.hasHindiAudio ? 'Hindi' : streamPayload.audioLanguages?.[0],
            },
          ]
        : [];

  const playableSources = candidateSources
    .filter((src) => isPlayableStreamUrl(src.url))
    .map((src) => {
      const lowerUrl = src.url.toLowerCase();
      if (lowerUrl.includes('.m3u8') && !lowerUrl.includes('/video/') && !lowerUrl.includes('/embed')) {
        return { ...src, type: 'hls' as const, isM3U8: true };
      }
      return src;
    });

  if (playableSources.length === 0) {
    return {
      error: {
        statusCode: 404,
        endpointUrl: streamEndpoint,
        message: 'AnimeWorld India returned no playable streamLink for this episode.',
      },
    };
  }

  const detectedLanguages = streamPayload.audioLanguages || parsed.audioLanguages || [];
  const detectedLower = detectedLanguages.map((l) => l.toLowerCase());
  const hasHindiAudio =
    Boolean(streamPayload.hasHindiAudio) ||
    detectedLower.some((l) => l.includes('hindi') || l === 'hin');
  const hasEnglishAudio =
    detectedLower.some((l) => l.includes('english') || l === 'eng' || l === 'en') ||
    playableSources.some((s) => (s.language || '').toLowerCase().includes('english'));
  const hasJapaneseAudio =
    detectedLower.some((l) => l.includes('japanese') || l === 'jpn' || l === 'ja') ||
    playableSources.some((s) => (s.language || '').toLowerCase().includes('japanese'));

  // Enforce strict language fidelity: never play English as Hindi or play an unrelated language silently
  if (effectiveLang === 'hindi' && !hasHindiAudio) {
    return {
      error: {
        statusCode: 404,
        endpointUrl: streamEndpoint,
        message:
          detectedLanguages.length > 0
            ? `Hindi (DUB) audio track is not available on AnimeWorld India for Episode ${episodeNumber} (available tracks: ${detectedLanguages.join(', ')}). Select Japanese (SUB) or English (DUB) instead.`
            : `Hindi (DUB) audio track was not found for Episode ${episodeNumber} on AnimeWorld India.`,
      },
    };
  }

  if (effectiveLang === 'dub' && detectedLanguages.length > 0 && !hasEnglishAudio) {
    return {
      error: {
        statusCode: 404,
        endpointUrl: streamEndpoint,
        message: `English (DUB) audio track is not available on AnimeWorld India for Episode ${episodeNumber} (available tracks: ${detectedLanguages.join(', ')}). Switch to Vidstreaming or Megacloud for English DUB.`,
      },
    };
  }

  if (effectiveLang === 'sub' && detectedLanguages.length > 0 && !hasJapaneseAudio) {
    return {
      error: {
        statusCode: 404,
        endpointUrl: streamEndpoint,
        message: `Japanese (SUB) audio track is not available on AnimeWorld India for Episode ${episodeNumber} (available tracks: ${detectedLanguages.join(', ')}). Switch to Vidstreaming or Megacloud for Japanese SUB.`,
      },
    };
  }

  const matchesRequestedLang = (src: StreamSource): boolean => {
    const langLower = (src.language || '').toLowerCase();
    const isMultiAudioContainer =
      src.url.includes('ravok.buzz') || langLower.includes('multi');
    if (effectiveLang === 'hindi') {
      return langLower.includes('hindi') || langLower === 'hin' || (isMultiAudioContainer && hasHindiAudio);
    }
    if (effectiveLang === 'dub') {
      return langLower.includes('english') || langLower === 'eng' || isMultiAudioContainer;
    }
    return langLower.includes('japanese') || langLower === 'jpn' || isMultiAudioContainer;
  };

  const languageFiltered = playableSources.filter(matchesRequestedLang);
  const mappedSources =
    languageFiltered.length > 0
      ? languageFiltered
      : playableSources;

  return {
    data: {
      ...parsed,
      sources: mappedSources,
      downloadUrl: isGenuineMediaDownloadUrl(streamPayload.stream?.file)
        ? streamPayload.stream.file
        : isGenuineMediaDownloadUrl(parsed.downloadUrl)
          ? parsed.downloadUrl
          : undefined,
      hasHindiAudio,
      audioLanguages: detectedLanguages,
      requestedLanguage: effectiveLang,
      providerSource: streamPayload.source || streamEndpoint,
      servers: [{ name: 'animeworld-india' }],
    },
  };
}

export interface AnimeWorldFeaturedEpisode {
  seriesId: string;
  seriesTitle: string;
  seriesPoster: string | null;
  seasonId: string;
  seasonName: string;
  episode: AnimeWorldEpisode;
  epNum: number;
}

function extractEpisodeNumber(ep: AnimeWorldEpisode, fallbackIdx: number): number {
  const m =
    ep.episodeNumber?.match(/(\d+)/) ||
    ep.episodeId?.match(/\d+x(\d+)/i) ||
    ep.episodeId?.match(/episode[-_]?(\d+)/i);
  return m ? Number(m[1]) : fallbackIdx + 1;
}

export async function fetchAnimeWorldLatestEpisodes(
  seriesList: AnimeWorldItem[],
  maxSeries = 3,
  maxEpisodesTotal = 12
): Promise<AnimeWorldFeaturedEpisode[]> {
  const candidates = seriesList.filter((item) => Boolean(item.seriesId)).slice(0, maxSeries);
  if (candidates.length === 0) return [];

  const settled = await Promise.allSettled(
    candidates.map(async (item) => {
      const seriesId = item.seriesId as string;
      const seasonsRes = await fetchAnimeWorldSeasons(seriesId);
      const seasons = seasonsRes.data?.seasons || [];
      if (seasons.length === 0) return [] as AnimeWorldFeaturedEpisode[];

      // Prefer the newest dubbed season or last listed season, fallback to first
      const preferredSeason =
        [...seasons].reverse().find((s) => !s.isSubOnly) ||
        seasons[seasons.length - 1] ||
        seasons[0];

      const epsRes = await fetchAnimeWorldEpisodes(preferredSeason.seasonId);
      const eps = epsRes.data?.episodes || [];
      if (eps.length === 0) return [] as AnimeWorldFeaturedEpisode[];

      // Take the newest episodes from that season
      const perSeriesLimit = Math.max(3, Math.ceil(maxEpisodesTotal / candidates.length));
      const slice = eps.slice(-perSeriesLimit).reverse();
      return slice.map((ep, idx) => {
        const originalIdx = Math.max(0, eps.length - 1 - idx);
        return {
          seriesId,
          seriesTitle: seasonsRes.data?.series.title || item.title,
          seriesPoster: seasonsRes.data?.series.poster || item.image || null,
          seasonId: preferredSeason.seasonId,
          seasonName: preferredSeason.seasonName,
          episode: ep,
          epNum: extractEpisodeNumber(ep, originalIdx),
        };
      });
    })
  );

  const combined: AnimeWorldFeaturedEpisode[] = [];
  for (const res of settled) {
    if (res.status === 'fulfilled' && res.value.length > 0) {
      combined.push(...res.value);
    }
  }
  return combined.slice(0, maxEpisodesTotal);
}

