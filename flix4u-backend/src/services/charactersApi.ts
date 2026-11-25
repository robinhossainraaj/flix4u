import { getAnilistApiUrl, logApiDiagnostic, resolveApiUrl } from '@/src/config/env';
import type { AnimeCharacterAvatar } from '@/src/types/anime';

export interface SeriesFilterOption {
  id: string;
  label: string;
  mediaId?: number;
}

export type CharacterCategoryFilter = 'ALL' | 'MAIN' | 'SUPPORTING';

export const ANIME_SERIES_FILTERS: SeriesFilterOption[] = [
  { id: 'all', label: 'All Anime' },
  { id: 'naruto', label: 'Naruto', mediaId: 1735 },
  { id: 'one-piece', label: 'One Piece', mediaId: 21 },
  { id: 'dragon-ball', label: 'Dragon Ball', mediaId: 813 },
  { id: 'demon-slayer', label: 'Demon Slayer', mediaId: 101922 },
  { id: 'jujutsu-kaisen', label: 'Jujutsu Kaisen', mediaId: 113415 },
  { id: 'attack-on-titan', label: 'Attack on Titan', mediaId: 16498 },
  { id: 'blue-lock', label: 'Blue Lock', mediaId: 137822 },
  { id: 'solo-leveling', label: 'Solo Leveling', mediaId: 151807 },
  { id: 'bleach', label: 'Bleach', mediaId: 269 },
  { id: 'chainsaw-man', label: 'Chainsaw Man', mediaId: 127230 },
  { id: 'my-hero-academia', label: 'My Hero Academia', mediaId: 21459 },
  { id: 'hunter-x-hunter', label: 'Hunter x Hunter', mediaId: 11061 },
  { id: 'death-note', label: 'Death Note', mediaId: 1535 },
  { id: 'spy-x-family', label: 'Spy x Family', mediaId: 140960 },
  { id: 'fullmetal-alchemist', label: 'Fullmetal Alchemist', mediaId: 5114 },
  { id: 'tokyo-ghoul', label: 'Tokyo Ghoul', mediaId: 20605 },
  { id: 'black-clover', label: 'Black Clover', mediaId: 97940 },
];

export interface CharacterPageResult {
  characters: AnimeCharacterAvatar[];
  hasNextPage: boolean;
  currentPage: number;
}

const charCache = new Map<string, { expiresAt: number; data: CharacterPageResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function formatRoleLabel(role?: string | null): string | null {
  if (!role) return null;
  if (role === 'MAIN') return 'Main';
  if (role === 'SUPPORTING') return 'Supporting';
  if (role === 'BACKGROUND') return 'Background';
  return role;
}

function isUsableCharacterImage(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) return false;
  if (trimmed.includes('/default.jpg') || trimmed.includes('/default.png')) return false;
  return true;
}

async function gqlCharacterFetch<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const endpoints = [getAnilistApiUrl(), resolveApiUrl('/api/anilist')];
  const body = JSON.stringify({ query, variables });
  let lastErr: Error | null = null;

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        logApiDiagnostic('Characters', endpoint, {
          status: response.status,
          message: `HTTP ${response.status}`,
        });
        lastErr = new Error(`Character catalog request failed (HTTP ${response.status})`);
        continue;
      }
      const payload = await response.json();
      if (payload?.errors?.length) {
        const errMsg = payload.errors[0]?.message || 'AniList character query failed';
        logApiDiagnostic('Characters', endpoint, {
          status: response.status,
          message: errMsg,
        });
        throw new Error(errMsg);
      }
      return payload.data as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load character avatars.';
      logApiDiagnostic('Characters', endpoint, { message: msg });
      lastErr = err instanceof Error ? err : new Error('Unable to load character avatars.');
    } finally {
      window.clearTimeout(timer);
    }
  }

  throw lastErr || new Error('Unable to load character avatars.');
}

const CHARACTER_SEARCH_ALIASES: Record<string, string> = {
  jinwoo: 'Jin-U Seong',
  'sung jinwoo': 'Jin-U Seong',
  'sung jin-woo': 'Jin-U Seong',
  'jin woo': 'Jin-U Seong',
  goku: 'Gokuu',
};

function normalizeCharacterSearch(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const alias = CHARACTER_SEARCH_ALIASES[trimmed.toLowerCase()];
  return alias || trimmed;
}

export async function fetchCharacterGalleryPage(options: {
  search?: string;
  seriesId?: string;
  category?: CharacterCategoryFilter;
  page?: number;
  perPage?: number;
}): Promise<CharacterPageResult> {
  const search = normalizeCharacterSearch(options.search || '');
  const seriesId = options.seriesId || 'all';
  const category = options.category || 'ALL';
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 24;

  const cacheKey = JSON.stringify({ search: search.toLowerCase(), seriesId, category, page, perPage });
  const now = Date.now();
  const cached = charCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const selectedSeries = ANIME_SERIES_FILTERS.find((s) => s.id === seriesId);

  // If filtering by a specific anime series (with optional search text)
  if (selectedSeries?.mediaId) {
    const query = `
      query SeriesCharacters($mediaId: Int, $page: Int, $perPage: Int, $role: CharacterRole) {
        Media(id: $mediaId, type: ANIME) {
          id
          title {
            english
            romaji
          }
          characters(page: $page, perPage: $perPage, role: $role, sort: [ROLE, FAVOURITES_DESC]) {
            pageInfo {
              hasNextPage
              currentPage
            }
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
                image {
                  large
                  medium
                }
                favourites
              }
            }
          }
        }
      }
    `;

    // When searching inside a series, request up to 50 per page so local name match finds characters cleanly
    const effectivePerPage = search ? 50 : perPage;
    const variables: Record<string, unknown> = {
      mediaId: selectedSeries.mediaId,
      page,
      perPage: effectivePerPage,
    };
    if (category !== 'ALL') {
      variables.role = category;
    }

    const data = await gqlCharacterFetch<{
      Media: {
        title: { english?: string | null; romaji?: string | null };
        characters: {
          pageInfo: { hasNextPage: boolean; currentPage: number };
          edges: Array<{
            role?: string | null;
            node: {
              id: number;
              name?: { full?: string | null; native?: string | null };
              image?: { large?: string | null; medium?: string | null };
              favourites?: number | null;
            };
          }>;
        };
      } | null;
    }>(query, variables);

    const media = data.Media;
    const seriesName = selectedSeries.label || media?.title?.english || media?.title?.romaji || 'Anime';
    const rawEdges = media?.characters?.edges || [];
    const searchLower = search.toLowerCase();

    const mapped = rawEdges
      .map((edge): AnimeCharacterAvatar | null => {
        const node = edge.node;
        const img = node?.image?.large || node?.image?.medium;
        const fullName = node?.name?.full?.trim();
        if (!node || !fullName || !isUsableCharacterImage(img)) return null;
        if (searchLower) {
          const hay = `${fullName} ${node.name?.native || ''}`.toLowerCase();
          if (!hay.includes(searchLower)) return null;
        }
        return {
          id: node.id,
          name: fullName,
          nativeName: node.name?.native || null,
          imageUrl: img,
          mediumImageUrl: node.image?.medium || img,
          seriesTitle: seriesName,
          role: formatRoleLabel(edge.role),
          favourites: node.favourites ?? null,
        };
      })
      .filter((x): x is AnimeCharacterAvatar => Boolean(x));

    const result: CharacterPageResult = {
      characters: mapped,
      hasNextPage: Boolean(media?.characters?.pageInfo?.hasNextPage),
      currentPage: page,
    };
    charCache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, data: result });
    return result;
  }

  // Global character browsing / search across all anime
  const query = `
    query GlobalCharacters($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
          currentPage
        }
        characters(search: $search, sort: FAVOURITES_DESC) {
          id
          name {
            full
            native
          }
          image {
            large
            medium
          }
          favourites
          media(sort: POPULARITY_DESC, perPage: 1) {
            edges {
              characterRole
              node {
                title {
                  english
                  romaji
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    page,
    perPage: category === 'ALL' ? perPage : Math.min(perPage * 2, 48),
  };
  if (search) variables.search = search;

  const data = await gqlCharacterFetch<{
    Page: {
      pageInfo: { hasNextPage: boolean; currentPage: number };
      characters: Array<{
        id: number;
        name?: { full?: string | null; native?: string | null };
        image?: { large?: string | null; medium?: string | null };
        favourites?: number | null;
        media?: {
          edges?: Array<{
            characterRole?: string | null;
            node?: { title?: { english?: string | null; romaji?: string | null } };
          }>;
        };
      }>;
    };
  }>(query, variables);

  const rawChars = data.Page?.characters || [];
  const mapped = rawChars
    .map((ch): AnimeCharacterAvatar | null => {
      const img = ch?.image?.large || ch?.image?.medium;
      const fullName = ch?.name?.full?.trim();
      if (!fullName || !isUsableCharacterImage(img)) return null;
      const topEdge = ch.media?.edges?.[0];
      if (category !== 'ALL' && topEdge?.characterRole && topEdge.characterRole !== category) {
        return null;
      }
      const seriesTitle =
        topEdge?.node?.title?.english ||
        topEdge?.node?.title?.romaji ||
        'Anime Character';
      return {
        id: ch.id,
        name: fullName,
        nativeName: ch.name?.native || null,
        imageUrl: img,
        mediumImageUrl: ch.image?.medium || img,
        seriesTitle,
        role: formatRoleLabel(topEdge?.characterRole),
        favourites: ch.favourites ?? null,
      };
    })
    .filter((x): x is AnimeCharacterAvatar => Boolean(x));

  const result: CharacterPageResult = {
    characters: mapped,
    hasNextPage: Boolean(data.Page?.pageInfo?.hasNextPage),
    currentPage: page,
  };
  charCache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, data: result });
  return result;
}
