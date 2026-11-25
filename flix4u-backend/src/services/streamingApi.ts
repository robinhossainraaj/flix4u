import {
  getConsumetApiBase,
  getDefaultStreamingApiBase,
  getStreamingApiBase,
  logApiDiagnostic,
  resolveApiUrl,
} from '@/src/config/env';
import { getDisplayTitle, slugifyTitle } from '@/src/services/anilistApi';
import { authorizedApiFetch } from '@/src/services/authorizedFetch';
import { fetchAniZipMetadata } from '@/src/services/extensionsApi';
import {
  extractErrorDetails,
  isPlayableStreamUrl,
  parseSafeJsonResponse,
} from '@/src/utils/errorUtils';
import type {
  AnimeDetail,
  AniZipResponse,
  AudioAvailabilityResponse,
  EpisodeItem,
  ParsedStreamResult,
  SkipInterval,
  StreamFetchError,
  StreamServer,
  StreamSource,
  StreamSubtitle,
} from '@/src/types/anime';

export interface EpisodesFetchResult {
  episodes: EpisodeItem[];
  source: 'provider' | 'metadata-fallback';
  providerError?: StreamFetchError;
  aniZipMalId?: number | null;
}

function normalizeTrackUrl(raw: string): string {
  return raw.trim().replace(/^https:\/{3,}/i, 'https://').replace(/^http:\/{3,}/i, 'http://');
}

async function fetchApiWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
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

function classifyStreamType(
  url: string,
  explicitM3u8?: boolean,
  explicitType?: unknown
): 'hls' | 'mp4' | 'embed' {
  if (explicitType === 'embed' || explicitType === 'iframe') return 'embed';
  if (explicitType === 'mp4') return 'mp4';
  const lower = url.toLowerCase();
  let inspectUrl = lower;
  if (lower.includes('/api/anime/proxy') && lower.includes('url=')) {
    try {
      const parsed = new URL(url, 'https://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) inspectUrl = inner.toLowerCase();
    } catch {
      // keep outer URL
    }
  }
  if (
    inspectUrl.includes('embed') ||
    inspectUrl.includes('iframe') ||
    inspectUrl.includes('/e/') ||
    inspectUrl.includes('abyssplayer') ||
    inspectUrl.includes('ravok') ||
    inspectUrl.includes('short.icu') ||
    inspectUrl.includes('megaplay') ||
    inspectUrl.includes('multi-lang-plyr') ||
    inspectUrl.includes('vidmoly') ||
    inspectUrl.includes('streamtape') ||
    inspectUrl.includes('filemoon') ||
    inspectUrl.includes('streamwish') ||
    inspectUrl.includes('voe.sx') ||
    inspectUrl.includes('dood') ||
    inspectUrl.includes('mixdrop') ||
    inspectUrl.includes('/video/')
  ) {
    return 'embed';
  }
  if (/\.(mp4|webm|mkv)(\?|$)/i.test(inspectUrl)) return 'mp4';
  if (
    explicitM3u8 === true ||
    explicitType === 'hls' ||
    inspectUrl.includes('.m3u8') ||
    inspectUrl.includes('.m3u?') ||
    inspectUrl.endsWith('.m3u') ||
    inspectUrl.includes('/master.txt')
  ) {
    return 'hls';
  }
  return 'embed';
}

/**
 * Flexibly parses real responses from streaming endpoints
 * without assuming a single rigid JSON shape.
 */
export function parseWatchResponse(payload: unknown): ParsedStreamResult {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const dataObj =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  const sources: StreamSource[] = [];
  const subtitles: StreamSubtitle[] = [];
  const servers: StreamServer[] = [];

  const rawSources = Array.isArray(dataObj.sources)
    ? dataObj.sources
    : Array.isArray(dataObj.streams)
      ? dataObj.streams
      : [];

  for (const item of rawSources) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const rawUrl =
      typeof s.url === 'string'
        ? s.url
        : typeof s.file === 'string'
          ? s.file
          : typeof s.streamLink === 'string'
            ? s.streamLink
            : '';
    const url = rawUrl.startsWith('/') ? resolveApiUrl(rawUrl) : normalizeTrackUrl(rawUrl);
    if (!url) continue;
    const isM3U8 = Boolean(s.isM3U8 ?? s.hls ?? url.toLowerCase().includes('.m3u8'));
    const quality =
      typeof s.quality === 'string' && s.quality.trim()
        ? s.quality.trim()
        : typeof s.label === 'string' && s.label.trim()
          ? s.label.trim()
          : 'Auto';
    const language = typeof s.language === 'string' && s.language.trim() ? s.language.trim() : undefined;
    const type = classifyStreamType(url, isM3U8, s.type);
    sources.push({
      url,
      quality,
      isM3U8: type === 'hls',
      type,
      language,
    });
  }

  // Handle single direct URL or embed fields (including AnimeWorld stream.streamLink)
  const streamNested =
    dataObj.stream && typeof dataObj.stream === 'object'
      ? (dataObj.stream as Record<string, unknown>)
      : null;

  const directCandidates: Array<{ url: unknown; explicitType?: unknown }> = [
    { url: dataObj.source, explicitType: dataObj.type },
    { url: dataObj.stream, explicitType: dataObj.type },
    { url: streamNested?.streamLink, explicitType: streamNested?.type },
    { url: dataObj.url, explicitType: dataObj.type },
    { url: dataObj.embed, explicitType: 'embed' },
    { url: dataObj.iframe, explicitType: 'embed' },
    { url: dataObj.embedURL, explicitType: 'embed' },
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate.url === 'string' && candidate.url.trim().startsWith('http')) {
      const url = normalizeTrackUrl(candidate.url);
      const exists = sources.some((s) => s.url === url);
      if (!exists) {
        const type = classifyStreamType(url, candidate.explicitType === 'hls', candidate.explicitType);
        sources.push({
          url,
          quality: type === 'embed' ? 'Embed Player' : 'Default',
          isM3U8: type === 'hls',
          type,
        });
      }
    }
  }

  const rawSubs = Array.isArray(dataObj.subtitles)
    ? dataObj.subtitles
    : Array.isArray(dataObj.tracks)
      ? dataObj.tracks
      : [];

  for (const sub of rawSubs) {
    if (!sub || typeof sub !== 'object') continue;
    const t = sub as Record<string, unknown>;
    const rawUrl = typeof t.url === 'string' ? t.url : typeof t.file === 'string' ? t.file : '';
    if (!rawUrl) continue;
    const lang =
      typeof t.lang === 'string'
        ? t.lang
        : typeof t.label === 'string'
          ? t.label
          : 'Subtitles';
    if (
      lang.trim().toLowerCase() === 'thumbnails' ||
      rawUrl.toLowerCase().includes('thumbnails.vtt')
    ) {
      continue;
    }
    const url = rawUrl.startsWith('/') ? resolveApiUrl(rawUrl) : normalizeTrackUrl(rawUrl);
    subtitles.push({
      url,
      lang,
      label: lang,
    });
  }

  const rawServers = Array.isArray(dataObj.servers) ? dataObj.servers : [];
  for (const srv of rawServers) {
    if (typeof srv === 'string') {
      servers.push({ name: srv });
    } else if (srv && typeof srv === 'object') {
      const obj = srv as Record<string, unknown>;
      const name =
        typeof obj.name === 'string'
          ? obj.name
          : typeof obj.serverName === 'string'
            ? obj.serverName
            : '';
      if (name) {
        servers.push({
          name,
          url: typeof obj.url === 'string' ? obj.url : undefined,
        });
      }
    }
  }

  const headers =
    dataObj.headers && typeof dataObj.headers === 'object'
      ? (dataObj.headers as Record<string, string>)
      : undefined;

  const downloadUrl =
    typeof dataObj.download === 'string'
      ? dataObj.download
      : typeof streamNested?.file === 'string'
        ? streamNested.file
        : undefined;

  const parseSkip = (raw: unknown): SkipInterval | undefined => {
    if (!raw || typeof raw !== 'object') return undefined;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.start === 'number' && typeof obj.end === 'number' && obj.end > obj.start) {
      return {
        start: obj.start,
        end: obj.end,
        type: typeof obj.type === 'string' ? (obj.type as SkipInterval['type']) : undefined,
        source: obj.source === 'aniskip' ? 'aniskip' : 'provider',
      };
    }
    return undefined;
  };

  const intro = parseSkip(dataObj.intro);
  const outro = parseSkip(dataObj.outro);
  const recap = parseSkip(dataObj.recap);

  const audioLanguages = Array.isArray(dataObj.audioLanguages)
    ? (dataObj.audioLanguages.filter((x) => typeof x === 'string') as string[])
    : undefined;

  const hasHindiAudio =
    typeof dataObj.hasHindiAudio === 'boolean' ? dataObj.hasHindiAudio : undefined;

  const requestedLanguage =
    dataObj.requestedLanguage === 'sub' ||
    dataObj.requestedLanguage === 'dub' ||
    dataObj.requestedLanguage === 'hindi'
      ? dataObj.requestedLanguage
      : undefined;

  return {
    sources,
    subtitles,
    servers,
    headers,
    downloadUrl,
    intro,
    outro,
    recap,
    hasHindiAudio,
    audioLanguages,
    requestedLanguage,
    providerSource:
      typeof dataObj.source === 'string' ? dataObj.source : undefined,
    rawResponse: payload,
  };
}

function buildMetadataEpisodes(
  anime?: AnimeDetail,
  aniZip?: AniZipResponse | null
): EpisodeItem[] {
  const baseSlug = anime
    ? slugifyTitle(anime.title.romaji || getDisplayTitle(anime.title)) || `anime-${anime.id}`
    : `anime-${aniZip?.anilistId || 'series'}`;

  const zipEpisodes = aniZip?.episodes || {};
  const zipNumbers = Object.keys(zipEpisodes)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxZipEpisode = zipNumbers.length > 0 ? Math.max(...zipNumbers) : 0;

  const releasedCount = anime?.nextAiringEpisode?.episode
    ? Math.max(1, anime.nextAiringEpisode.episode - 1)
    : anime?.episodes || anime?.streamingEpisodes?.length || maxZipEpisode || 0;

  const count = Math.min(
    Math.max(releasedCount, anime?.streamingEpisodes?.length || 0, maxZipEpisode),
    2000
  );
  if (count === 0) return [];

  const streamMap = new Map<
    number,
    { title?: string | null; thumbnail?: string | null; url?: string | null }
  >();
  if (anime?.streamingEpisodes?.length) {
    anime.streamingEpisodes.forEach((se, index) => {
      const match = se.title?.match(/Episode\s+(\d+)/i);
      const epNum = match ? parseInt(match[1], 10) : index + 1;
      streamMap.set(epNum, {
        title: se.title?.replace(/^Episode\s+\d+\s*[-–:]?\s*/i, '').trim() || se.title,
        thumbnail: se.thumbnail,
        url: se.url,
      });
    });
  }

  const list: EpisodeItem[] = [];
  for (let i = 1; i <= count; i++) {
    const meta = streamMap.get(i);
    const zipEp = zipEpisodes[String(i)];
    list.push({
      id: `${baseSlug}-episode-${i}`,
      dubId: `${baseSlug}-dub-episode-${i}`,
      number: i,
      title: zipEp?.title || meta?.title || `Episode ${i}`,
      description: zipEp?.overview,
      image: zipEp?.image || meta?.thumbnail || anime?.coverImage?.large || null,
      airDate: zipEp?.airDate || null,
      runtime: zipEp?.runtime ?? null,
      externalUrl: meta?.url || null,
      hasDub: undefined,
    });
  }
  return list;
}

function mergeEpisodesWithAniZip(
  episodes: EpisodeItem[],
  aniZip?: AniZipResponse | null
): EpisodeItem[] {
  if (!aniZip?.episodes) return episodes;
  return episodes.map((ep) => {
    const zipEp = aniZip.episodes[String(ep.number)];
    if (!zipEp) return ep;
    const isGenericTitle = /^Episode\s+\d+$/i.test(ep.title.trim());
    return {
      ...ep,
      title: isGenericTitle && zipEp.title ? zipEp.title : ep.title || zipEp.title,
      description: ep.description || zipEp.overview,
      image: ep.image || zipEp.image || null,
      airDate: ep.airDate || zipEp.airDate || null,
      runtime: ep.runtime ?? zipEp.runtime ?? null,
    };
  });
}

function getCustomBaseParam(): string | null {
  const current = getStreamingApiBase();
  const def = getDefaultStreamingApiBase();
  return current !== def ? current : null;
}

export async function fetchAnimeEpisodes(
  anilistId: number,
  anime?: AnimeDetail,
  category: 'sub' | 'dub' | 'hindi' = 'sub'
): Promise<EpisodesFetchResult> {
  const params = new URLSearchParams();
  if (category === 'dub' || category === 'hindi') params.set('dub', 'true');
  const customBase = getCustomBaseParam();
  if (customBase) params.set('base', customBase);

  const queryStr = params.toString();
  const endpointUrl = `/api/anime/info/${anilistId}${queryStr ? `?${queryStr}` : ''}`;
  const resolvedUrl = resolveApiUrl(endpointUrl);

  const [infoRes, aniZip] = await Promise.all([
    authorizedApiFetch(resolvedUrl, { timeoutMs: 15000 }).catch((err) => {
      logApiDiagnostic('AnimeInfo', resolvedUrl, {
        message: err instanceof Error ? err.message : 'Network request failed',
      });
      return null;
    }),
    fetchAniZipMetadata(anilistId),
  ]);

  const aniZipMalId = aniZip?.mappings?.malId ?? null;

  try {
    if (!infoRes || !infoRes.ok) {
      if (infoRes) {
        logApiDiagnostic('AnimeInfo', resolvedUrl, {
          status: infoRes.status,
          message: `HTTP ${infoRes.status}`,
        });
      }
      return {
        episodes: buildMetadataEpisodes(anime, aniZip),
        source: 'metadata-fallback',
        aniZipMalId,
        providerError: infoRes
          ? {
              statusCode: infoRes.status,
              endpointUrl: resolvedUrl,
              message: `Streaming info API returned HTTP ${infoRes.status}.`,
            }
          : {
              endpointUrl: resolvedUrl,
              message: 'Unable to reach streaming info endpoint.',
            },
      };
    }

    const json = (await infoRes.json()) as Record<string, unknown>;
    const rawEpisodes = Array.isArray(json.episodes) ? json.episodes : [];
    if (rawEpisodes.length === 0) {
      return {
        episodes: buildMetadataEpisodes(anime, aniZip),
        source: 'metadata-fallback',
        aniZipMalId,
        providerError: json.upstreamError
          ? extractErrorDetails(
              json.upstreamError,
              resolvedUrl,
              undefined,
              'External streaming info endpoint returned no episodes.'
            )
          : undefined,
      };
    }

    const parsed: EpisodeItem[] = rawEpisodes
      .map((ep, idx): EpisodeItem | null => {
        if (!ep || typeof ep !== 'object') return null;
        const item = ep as Record<string, unknown>;
        const id = typeof item.id === 'string' ? item.id : '';
        if (!id) return null;
        const number = typeof item.number === 'number' ? item.number : idx + 1;
        return {
          id,
          dubId: typeof item.dubId === 'string' ? item.dubId : undefined,
          number,
          title:
            typeof item.title === 'string' && item.title.trim()
              ? item.title
              : `Episode ${number}`,
          description: typeof item.description === 'string' ? item.description : undefined,
          image: typeof item.image === 'string' ? item.image : null,
          isFiller: Boolean(item.isFiller),
          hasDub: Boolean(item.dubId || item.hasDub || category === 'dub'),
        };
      })
      .filter((x): x is EpisodeItem => Boolean(x));

    return {
      episodes: mergeEpisodesWithAniZip(parsed, aniZip),
      source: 'provider',
      aniZipMalId,
    };
  } catch (err) {
    return {
      episodes: buildMetadataEpisodes(anime, aniZip),
      source: 'metadata-fallback',
      aniZipMalId,
      providerError: {
        endpointUrl: resolvedUrl,
        message: err instanceof Error ? err.message : 'Unable to reach streaming info endpoint.',
      },
    };
  }
}

export async function fetchEpisodeServers(episodeId: string): Promise<StreamServer[]> {
  if (!episodeId || episodeId === 'EPISODE_ID') return [];
  const params = new URLSearchParams();
  const customBase = getCustomBaseParam();
  if (customBase) params.set('base', customBase);
  const queryStr = params.toString();
  const endpointUrl = `/api/anime/servers/${encodeURIComponent(episodeId)}${
    queryStr ? `?${queryStr}` : ''
  }`;
  const resolvedUrl = resolveApiUrl(endpointUrl);

  try {
    const res = await authorizedApiFetch(resolvedUrl, { timeoutMs: 12000 });
    if (!res.ok) {
      logApiDiagnostic('Servers', resolvedUrl, { status: res.status, message: `HTTP ${res.status}` });
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        if (typeof item === 'string') return { name: item };
        if (
          item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).name === 'string'
        ) {
          return {
            name: (item as Record<string, unknown>).name as string,
            url:
              typeof (item as Record<string, unknown>).url === 'string'
                ? ((item as Record<string, unknown>).url as string)
                : undefined,
          };
        }
        return null;
      })
      .filter((x): x is StreamServer => Boolean(x && !x.name.toLowerCase().includes('animeworld')));
  } catch {
    return [];
  }
}

export async function fetchEpisodeStream(
  episodeId: string,
  options?: {
    server?: string;
    category?: 'sub' | 'dub' | 'hindi';
    anilistId?: number;
    malId?: number | null;
    episodeNumber?: number;
  }
): Promise<{ data?: ParsedStreamResult; error?: StreamFetchError }> {
  const cleanEpisodeId = (episodeId || '').trim();
  if (!cleanEpisodeId || cleanEpisodeId === 'EPISODE_ID') {
    return {
      error: {
        endpointUrl: '',
        message: 'No valid episode ID was selected for playback.',
      },
    };
  }

  const params = new URLSearchParams();
  if (options?.server) params.set('server', options.server);
  if (options?.category) params.set('category', options.category);
  if (options?.anilistId) params.set('anilistId', String(options.anilistId));
  if (options?.malId) params.set('malId', String(options.malId));
  if (options?.episodeNumber) params.set('ep', String(options.episodeNumber));
  if (options?.server?.toLowerCase() === 'munchyroll') {
    const consumetBase = getConsumetApiBase();
    if (consumetBase) params.set('consumetBase', consumetBase);
  } else {
    const customBase = getCustomBaseParam();
    if (customBase) params.set('base', customBase);
  }

  const queryStr = params.toString();
  const endpointUrl = `/api/anime/watch/${encodeURIComponent(cleanEpisodeId)}${
    queryStr ? `?${queryStr}` : ''
  }`;
  const resolvedUrl = resolveApiUrl(endpointUrl);

  const normalizeStreamError = (errObj: StreamFetchError): StreamFetchError => {
    if (
      /couldn't find this episode/i.test(errObj.message) ||
      /may not exist/i.test(errObj.message)
    ) {
      const serverName = options?.server || 'this server';
      const langLabel =
        options?.category === 'dub'
          ? 'English (DUB)'
          : options?.category === 'hindi'
            ? 'Hindi (DUB)'
            : 'Japanese (SUB)';
      return {
        ...errObj,
        message: `${langLabel} stream is currently unavailable on ${serverName} for this episode. Try another server or switch audio language.`,
      };
    }
    return errObj;
  };

  try {
    const response = await authorizedApiFetch(resolvedUrl, { timeoutMs: 22000 });

    const parsedResp = await parseSafeJsonResponse<Record<string, unknown>>(response);
    const json = parsedResp.data;

    if (!parsedResp.ok) {
      const errObj = normalizeStreamError(
        extractErrorDetails(
          json || parsedResp.rawText,
          resolvedUrl,
          parsedResp.status,
          `Streaming server returned HTTP ${parsedResp.status}.`
        )
      );
      logApiDiagnostic('WatchStream', resolvedUrl, {
        status: parsedResp.status,
        message: errObj.message,
      });
      return { error: errObj };
    }

    const parsed = parseWatchResponse(json);
    const validSources = parsed.sources.filter((s) => isPlayableStreamUrl(s.url));

    if (validSources.length === 0) {
      const errObj = normalizeStreamError(
        extractErrorDetails(
          json || parsedResp.rawText,
          resolvedUrl,
          parsedResp.status,
          'The streaming provider returned no playable stream sources for this episode.'
        )
      );
      logApiDiagnostic('WatchStream', resolvedUrl, {
        status: parsedResp.status,
        message: errObj.message,
      });
      return { error: errObj };
    }

    return {
      data: {
        ...parsed,
        sources: validSources,
      },
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const extracted = extractErrorDetails(
      isTimeout ? 'Streaming backend request timed out after 22 seconds.' : err,
      resolvedUrl,
      undefined,
      'Network error while contacting streaming backend.'
    );
    logApiDiagnostic('WatchStream', resolvedUrl, {
      status: extracted.statusCode,
      message: extracted.message,
    });
    return {
      error: {
        ...extracted,
        message: extracted.message.startsWith('Failed to fetch')
          ? extracted.message
          : `Failed to fetch episode stream: ${extracted.message}`,
      },
    };
  }
}

export async function fetchAudioAvailability(options: {
  anilistId?: number;
  malId?: number | null;
  episodeNumber: number;
  title?: string | null;
  romajiTitle?: string | null;
  format?: string | null;
}): Promise<AudioAvailabilityResponse | null> {
  const params = new URLSearchParams();
  if (options.anilistId) params.set('anilistId', String(options.anilistId));
  if (options.malId) params.set('malId', String(options.malId));
  params.set('ep', String(Math.max(1, options.episodeNumber || 1)));
  if (options.title) params.set('title', options.title);
  if (options.romajiTitle) params.set('romajiTitle', options.romajiTitle);
  if (options.format) params.set('format', options.format);
  const customBase = getCustomBaseParam();
  if (customBase) params.set('base', customBase);

  const resolvedUrl = resolveApiUrl(`/api/anime/audio-availability?${params.toString()}`);
  try {
    const res = await authorizedApiFetch(resolvedUrl, { timeoutMs: 12000 });
    if (!res.ok) {
      logApiDiagnostic('AudioAvailability', resolvedUrl, { status: res.status });
      return null;
    }
    const parsed = await parseSafeJsonResponse<AudioAvailabilityResponse>(res);
    return parsed.ok ? parsed.data : null;
  } catch (err) {
    logApiDiagnostic('AudioAvailability', resolvedUrl, {
      message: err instanceof Error ? err.message : 'Audio availability check failed',
    });
    return null;
  }
}
