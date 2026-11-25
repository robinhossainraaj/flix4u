import { getAnilistApiUrl, logApiDiagnostic, resolveApiUrl } from '@/src/config/env';
import type { AiringScheduleItem, AnimeDetail, AnimeSummary } from '@/src/types/anime';

const cache = new Map<string, { expiresAt: number; data: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 120;

function setBoundedCache(key: string, data: unknown, ttlMs = CACHE_TTL_MS): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, { expiresAt: Date.now() + ttlMs, data });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 12000,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

async function gqlFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<T> {
  const key = JSON.stringify({ query, variables });
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    // Refresh LRU order
    cache.delete(key);
    cache.set(key, cached);
    return cached.data as T;
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (!signal) {
    const existingFlight = inFlight.get(key);
    if (existingFlight) {
      return existingFlight as Promise<T>;
    }
  }

  const execute = async (): Promise<T> => {
    const directUrl = getAnilistApiUrl();
    const proxyUrl = resolveApiUrl('/api/anilist');
    const endpoints = proxyUrl !== directUrl ? [directUrl, proxyUrl] : [directUrl];
    const body = JSON.stringify({ query, variables });

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        try {
          const response = await fetchWithTimeout(
            endpoint,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body,
            },
            12000,
            signal
          );

          if (response.status === 429 || response.status >= 500) {
            logApiDiagnostic('AniList', endpoint, {
              status: response.status,
              message: `HTTP ${response.status} on attempt ${attempt + 1}`,
            });
            lastError = new Error(`AniList metadata request failed with HTTP ${response.status}`);
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 450));
              continue;
            }
            break;
          }

          if (!response.ok) {
            logApiDiagnostic('AniList', endpoint, {
              status: response.status,
              message: `Unexpected HTTP ${response.status}`,
            });
            throw new Error(`AniList metadata request failed with HTTP ${response.status}`);
          }

          const payload = await response.json();
          if (payload?.errors?.length) {
            logApiDiagnostic('AniList', endpoint, {
              status: response.status,
              message: payload.errors[0]?.message || 'AniList GraphQL error',
            });
            throw new Error(payload.errors[0]?.message || 'AniList GraphQL error');
          }
          if (!payload?.data) {
            throw new Error('AniList returned an empty data payload.');
          }

          setBoundedCache(key, payload.data, CACHE_TTL_MS);
          return payload.data as T;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
            throw err;
          }
          const msg =
            err instanceof Error
              ? err.name === 'AbortError'
                ? 'AniList metadata request timed out. Please check your connection.'
                : err.message
              : 'Unable to reach AniList catalog.';
          logApiDiagnostic('AniList', endpoint, {
            message: msg,
            extra: { attempt: attempt + 1 },
          });
          lastError = new Error(msg);
        }
      }
    }

    if (cached?.data) {
      return cached.data as T;
    }

    throw lastError || new Error('Unable to load AniList catalog.');
  };

  if (signal) {
    return execute();
  }

  const flightPromise = execute().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, flightPromise);
  return flightPromise;
}

const SUMMARY_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  format
  status
  episodes
  duration
  season
  seasonYear
  averageScore
  popularity
  genres
  description(asHtml: false)
  nextAiringEpisode {
    episode
    airingAt
    timeUntilAiring
  }
`;

export const FEATURED_PRIORITY_IDS = [2471, 527, 20] as const;

export interface HomeSectionsData {
  featuredPriority: AnimeSummary[];
  trending: AnimeSummary[];
  popular: AnimeSummary[];
  latestEpisodes: AnimeSummary[];
  recentlyUpdated: AnimeSummary[];
  upcoming: AnimeSummary[];
}

let lastHomeSectionsSnapshot: { expiresAt: number; data: HomeSectionsData } | null = null;

export function peekHomeSectionsCache(): HomeSectionsData | null {
  if (lastHomeSectionsSnapshot && lastHomeSectionsSnapshot.expiresAt > Date.now()) {
    return lastHomeSectionsSnapshot.data;
  }
  return null;
}

export async function getHomeSections(): Promise<HomeSectionsData> {
  const query = `
    query HomeSections($featuredIds: [Int]) {
      featuredPriority: Page(page: 1, perPage: 6) {
        media(type: ANIME, id_in: $featuredIds, isAdult: false) {
          ${SUMMARY_FIELDS}
        }
      }
      trending: Page(page: 1, perPage: 12) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          ${SUMMARY_FIELDS}
        }
      }
      popular: Page(page: 1, perPage: 12) {
        media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
          ${SUMMARY_FIELDS}
        }
      }
      latestEpisodes: Page(page: 1, perPage: 12) {
        media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC, isAdult: false) {
          ${SUMMARY_FIELDS}
        }
      }
      recentlyUpdated: Page(page: 1, perPage: 12) {
        media(type: ANIME, sort: UPDATED_AT_DESC, status_in: [RELEASING, FINISHED], isAdult: false) {
          ${SUMMARY_FIELDS}
        }
      }
      upcoming: Page(page: 1, perPage: 12) {
        media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: false) {
          ${SUMMARY_FIELDS}
        }
      }
    }
  `;

  const data = await gqlFetch<{
    featuredPriority: { media: AnimeSummary[] };
    trending: { media: AnimeSummary[] };
    popular: { media: AnimeSummary[] };
    latestEpisodes: { media: AnimeSummary[] };
    recentlyUpdated: { media: AnimeSummary[] };
    upcoming: { media: AnimeSummary[] };
  }>(query, { featuredIds: [...FEATURED_PRIORITY_IDS] });

  const featuredById = new Map((data.featuredPriority?.media || []).map((m) => [m.id, m]));
  const orderedFeatured = FEATURED_PRIORITY_IDS.map((id) => featuredById.get(id)).filter(
    (item): item is AnimeSummary => Boolean(item)
  );

  const result: HomeSectionsData = {
    featuredPriority: orderedFeatured,
    trending: data.trending?.media || [],
    popular: data.popular?.media || [],
    latestEpisodes: data.latestEpisodes?.media || [],
    recentlyUpdated: data.recentlyUpdated?.media || [],
    upcoming: data.upcoming?.media || [],
  };
  lastHomeSectionsSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, data: result };
  return result;
}

export async function getAnimeDetails(id: number): Promise<AnimeDetail> {
  const query = `
    query AnimeDetail($id: Int) {
      Media(id: $id, type: ANIME) {
        ${SUMMARY_FIELDS}
        studios(isMain: true) {
          nodes {
            id
            name
            isAnimationStudio
          }
        }
        trailer {
          id
          site
          thumbnail
        }
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
        relations {
          edges {
            relationType(version: 2)
            node {
              ${SUMMARY_FIELDS}
            }
          }
        }
      }
    }
  `;

  const data = await gqlFetch<{ Media: AnimeDetail | null }>(query, { id });
  if (!data?.Media) {
    throw new Error(`Anime #${id} metadata is currently unavailable.`);
  }
  return data.Media;
}

export interface SearchFilters {
  query?: string;
  genre?: string;
  genres?: string[];
  format?: string;
  status?: string;
  sort?: string;
  seasonYear?: number;
  minimumScore?: number;
  idIn?: number[];
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}

export interface SearchPageResult {
  items: AnimeSummary[];
  hasNextPage: boolean;
  total: number;
  currentPage: number;
}

export async function searchAnime(filters: SearchFilters): Promise<SearchPageResult> {
  const query = `
    query SearchAnime(
      $search: String,
      $genre: String,
      $genreIn: [String],
      $format: MediaFormat,
      $status: MediaStatus,
      $sort: [MediaSort],
      $seasonYear: Int,
      $minimumScore: Int,
      $idIn: [Int],
      $page: Int,
      $perPage: Int
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          hasNextPage
        }
        media(
          type: ANIME,
          isAdult: false,
          search: $search,
          genre: $genre,
          genre_in: $genreIn,
          format: $format,
          status: $status,
          sort: $sort,
          seasonYear: $seasonYear,
          averageScore_greater: $minimumScore,
          id_in: $idIn
        ) {
          ${SUMMARY_FIELDS}
        }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    page: filters.page ?? 1,
    perPage: filters.perPage ?? 24,
    sort: filters.sort ? [filters.sort] : filters.query ? ['SEARCH_MATCH'] : ['TRENDING_DESC'],
  };

  if (filters.query && filters.query.trim()) variables.search = filters.query.trim();
  if (filters.genre && filters.genre !== 'ALL') variables.genre = filters.genre;
  if (filters.genres && filters.genres.length > 0) variables.genreIn = filters.genres;
  if (filters.format && filters.format !== 'ALL') variables.format = filters.format;
  if (filters.status && filters.status !== 'ALL') variables.status = filters.status;
  if (filters.seasonYear) variables.seasonYear = filters.seasonYear;
  if (filters.minimumScore) variables.minimumScore = filters.minimumScore;
  if (filters.idIn && filters.idIn.length > 0) variables.idIn = filters.idIn;

  const data = await gqlFetch<{
    Page?: {
      pageInfo?: { total?: number; currentPage?: number; hasNextPage?: boolean };
      media?: AnimeSummary[];
    };
  }>(query, variables, filters.signal);

  return {
    items: (data.Page?.media || []).filter((item): item is AnimeSummary => Boolean(item && item.id)),
    hasNextPage: Boolean(data.Page?.pageInfo?.hasNextPage),
    total: Number(data.Page?.pageInfo?.total || 0),
    currentPage: Number(data.Page?.pageInfo?.currentPage || filters.page || 1),
  };
}

export async function getAiringSchedule(daysAhead = 7): Promise<AiringScheduleItem[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const startOfToday = nowSec - (nowSec % 86400);
  const endWindow = startOfToday + daysAhead * 86400;

  const query = `
    query AiringSchedule($start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${SUMMARY_FIELDS}
          }
        }
      }
    }
  `;

  const data = await gqlFetch<{
    Page?: { airingSchedules?: AiringScheduleItem[] };
  }>(query, { start: startOfToday, end: endWindow });

  return (data.Page?.airingSchedules || []).filter((item) => item.media && item.media.id);
}

export function getDisplayTitle(title?: AnimeSummary['title'] | null): string {
  if (!title) return 'Untitled Anime';
  return title.english || title.romaji || title.native || 'Untitled Anime';
}

export function stripHtml(raw?: string | null): string {
  if (!raw) return 'No synopsis available.';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const ANIME_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mecha',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export async function getRandomAnime(): Promise<AnimeSummary> {
  const randomPage = Math.floor(Math.random() * 20) + 1;
  const query = `
    query RandomAnimeQuery($page: Int) {
      Page(page: $page, perPage: 15) {
        media(type: ANIME, sort: [SCORE_DESC, POPULARITY_DESC], isAdult: false, averageScore_greater: 70) {
          ${SUMMARY_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await gqlFetch<{ Page: { media: AnimeSummary[] } }>(query, { page: randomPage });
    const list = (data.Page?.media || []).filter(
      (m) =>
        m.id &&
        (m.title.english || m.title.romaji) &&
        (m.coverImage?.large || m.coverImage?.extraLarge) &&
        m.description
    );
    if (list.length > 0) {
      return list[Math.floor(Math.random() * list.length)];
    }
  } catch (err) {
    console.warn('Random anime dynamic query failed, falling back to cached catalog:', err);
  }

  const sections = await getHomeSections();
  const pool = [
    ...(sections.popular || []),
    ...(sections.trending || []),
    ...(sections.featuredPriority || []),
  ].filter((m) => m && m.id && (m.title.english || m.title.romaji));

  if (pool.length === 0) {
    throw new Error('Unable to pick a random anime. Please check your network.');
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
