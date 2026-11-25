import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Keyboard,
  Languages,
  Loader2,
  Package,
  Play,
  Search,
  Server,
  X,
} from 'lucide-react';
import { VideoPlayer } from '@/src/components/VideoPlayer';
import { useWatchSessionHeartbeat } from '@/src/hooks/useWatchSessionHeartbeat';

const DownloadManagerModal = lazy(() =>
  import('@/src/components/DownloadManagerModal').then((m) => ({
    default: m.DownloadManagerModal,
  }))
);
const ExtensionManager = lazy(() =>
  import('@/src/components/ExtensionManager').then((m) => ({
    default: m.ExtensionManager,
  }))
);
const OfflinePlayerModal = lazy(() =>
  import('@/src/components/OfflinePlayerModal').then((m) => ({
    default: m.OfflinePlayerModal,
  }))
);
import { isNativeCapacitorRuntime, resolveApiUrl } from '@/src/config/env';
import { useAuth } from '@/src/context/AuthContext';
import {
  getDownloadById,
  selectDownloadableSource,
  startDownloadEpisode,
  type DownloadItem,
} from '@/src/services/downloadService';
import { getAnimeDetails, getDisplayTitle } from '@/src/services/anilistApi';
import { resolveAnimeWorldStreamForAnime } from '@/src/services/animeWorldApi';
import {
  fetchAniSkipTimestamps,
  fetchExtensionsCatalog,
  getEnabledExtensionIds,
} from '@/src/services/extensionsApi';
import {
  fetchAnimeEpisodes,
  fetchAudioAvailability,
  fetchEpisodeServers,
  fetchEpisodeStream,
} from '@/src/services/streamingApi';
import type {
  AnimeDetail,
  AniSkipResponse,
  AudioAvailabilityResponse,
  EpisodeItem,
  ExtensionRepoItem,
  ParsedStreamResult,
  StreamFetchError,
  StreamServer,
} from '@/src/types/anime';

const SUB_DUB_FALLBACK_SERVERS: StreamServer[] = [
  { name: 'vidstreaming' },
  { name: 'megacloud' },
  { name: 'streamsb' },
  { name: 'animepahe' },
  { name: 'aniwatchtv' },
  { name: 'hianime' },
  { name: 'kaido' },
  { name: 'munchyroll' },
];

const HINDI_FALLBACK_SERVERS: StreamServer[] = [
  { name: 'animeworld-india' },
];

function ensureStandardServers(list: StreamServer[]): StreamServer[] {
  const seen = new Set<string>();
  const merged: StreamServer[] = [];

  for (const s of [...SUB_DUB_FALLBACK_SERVERS, ...list]) {
    const key = s.name.toLowerCase();
    if (key.includes('animeworld')) continue;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(s);
    }
  }
  return merged;
}

export const WatchPage: React.FC = () => {
  const { id, episodeId } = useParams<{ id: string; episodeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const animeId = Number(id);
  const decodedEpisodeId = episodeId ? decodeURIComponent(episodeId) : '';
  const epParam = Number(searchParams.get('ep') || 0);

  const {
    preferences,
    updatePreferences,
    isInWatchlist,
    toggleWatchlist,
    getHistoryForAnime,
    saveWatchProgress,
    recordWatchPlayback,
  } = useAuth();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [animeLoadError, setAnimeLoadError] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [epFilter, setEpFilter] = useState('');
  const [aniZipMalId, setAniZipMalId] = useState<number | null>(null);
  const [aniSkipData, setAniSkipData] = useState<AniSkipResponse | null>(null);
  const [adaptedExtensions, setAdaptedExtensions] = useState<ExtensionRepoItem[]>([]);
  const [servers, setServers] = useState<StreamServer[]>(
    preferences.preferredAudio === 'hindi' ? HINDI_FALLBACK_SERVERS : SUB_DUB_FALLBACK_SERVERS
  );
  const [selectedServer, setSelectedServer] = useState<string>(
    preferences.preferredAudio === 'hindi' ? 'animeworld-india' : 'vidstreaming'
  );
  const [audioMode, setAudioMode] = useState<'sub' | 'dub' | 'hindi'>(preferences.preferredAudio);
  const [autoNext, setAutoNext] = useState<boolean>(preferences.autoNext);

  useEffect(() => {
    if (audioMode === 'hindi') {
      setServers(HINDI_FALLBACK_SERVERS);
      setSelectedServer('animeworld-india');
    } else {
      setServers((prev) => {
        const filtered = prev.filter((s) => !s.name.toLowerCase().includes('animeworld'));
        return filtered.length > 0 ? filtered : SUB_DUB_FALLBACK_SERVERS;
      });
      if (selectedServer.toLowerCase().includes('animeworld')) {
        setSelectedServer('vidstreaming');
      }
    }
  }, [audioMode]);

  const [streamData, setStreamData] = useState<ParsedStreamResult | null>(null);
  const [streamError, setStreamError] = useState<StreamFetchError | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [audioAvailability, setAudioAvailability] = useState<AudioAvailabilityResponse | null>(null);
  const [checkingAudio, setCheckingAudio] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [showDownloadManager, setShowDownloadManager] = useState(false);
  const [offlinePlayerItem, setOfflinePlayerItem] = useState<DownloadItem | null>(null);
  const [currentDownload, setCurrentDownload] = useState<DownloadItem | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<{
    message: string;
    canFallbackToSub?: boolean;
  } | null>(null);

  // Load enabled compatible Aniyomi source adapters
  useEffect(() => {
    let active = true;
    const syncExtensions = async () => {
      try {
        const catalog = await fetchExtensionsCatalog();
        if (!active) return;
        const enabledIds = getEnabledExtensionIds();
        const enabledAdapted = catalog.extensions.filter(
          (ext) => ext.compatible && enabledIds.includes(ext.id)
        );
        setAdaptedExtensions(enabledAdapted);
      } catch {
        // ignore extension catalog errors during playback
      }
    };
    syncExtensions();
    window.addEventListener('flix4u:extensions-updated', syncExtensions);
    return () => {
      active = false;
      window.removeEventListener('flix4u:extensions-updated', syncExtensions);
    };
  }, []);

  // Load Anime Details + Episodes list (enriched via AniZip)
  useEffect(() => {
    if (!Number.isFinite(animeId) || animeId <= 0) return;
    let active = true;
    const loadMeta = async () => {
      setLoadingEpisodes(true);
      setAnimeLoadError(null);
      try {
        const detail = await getAnimeDetails(animeId);
        if (!active) return;
        setAnime(detail);
        const epRes = await fetchAnimeEpisodes(animeId, detail, audioMode);
        if (!active) return;
        setEpisodes(epRes.episodes);
        if (epRes.aniZipMalId) setAniZipMalId(epRes.aniZipMalId);
      } catch (err) {
        if (!active) return;
        setAnimeLoadError(
          err instanceof Error ? err.message : 'Unable to load anime metadata.'
        );
      } finally {
        if (active) setLoadingEpisodes(false);
      }
    };
    loadMeta();
    return () => {
      active = false;
    };
  }, [animeId, audioMode]);

  const currentEpisodeIndex = useMemo(() => {
    if (episodes.length === 0) return -1;
    const byId = episodes.findIndex(
      (ep) => ep.id === decodedEpisodeId || ep.dubId === decodedEpisodeId
    );
    if (byId >= 0) return byId;
    if (epParam > 0) {
      const byNum = episodes.findIndex((ep) => ep.number === epParam);
      if (byNum >= 0) return byNum;
    }
    return 0;
  }, [episodes, decodedEpisodeId, epParam]);

  const currentEpisode: EpisodeItem | undefined =
    currentEpisodeIndex >= 0 ? episodes[currentEpisodeIndex] : undefined;

  const resolvedEpNumber = useMemo(() => {
    if (currentEpisode?.number) return currentEpisode.number;
    if (epParam > 0) return epParam;
    const match = decodedEpisodeId.match(/(?:episode|ep)[-_]?(\d+)/i);
    return match ? Number(match[1]) : 1;
  }, [currentEpisode?.number, epParam, decodedEpisodeId]);

  const effectiveEpisodeId = useMemo(() => {
    if (audioMode === 'dub' && currentEpisode?.dubId) {
      return currentEpisode.dubId;
    }
    return currentEpisode?.id || decodedEpisodeId || '';
  }, [audioMode, currentEpisode, decodedEpisodeId]);

  const effectiveMalId = anime?.idMal || aniZipMalId || undefined;
  const malIdRef = useRef<number | null | undefined>(effectiveMalId);
  malIdRef.current = effectiveMalId;

  useEffect(() => {
    if (!effectiveMalId || resolvedEpNumber <= 0) {
      setAniSkipData(null);
      return;
    }
    let active = true;
    fetchAniSkipTimestamps(effectiveMalId, resolvedEpNumber).then((res) => {
      if (active) setAniSkipData(res);
    });
    return () => {
      active = false;
    };
  }, [effectiveMalId, resolvedEpNumber]);

  // Real audio availability probe across Japanese (SUB), English (DUB), Hindi (DUB)
  useEffect(() => {
    if (!anime || resolvedEpNumber <= 0) return;
    let active = true;
    setCheckingAudio(true);
    fetchAudioAvailability({
      anilistId: animeId,
      malId: effectiveMalId,
      episodeNumber: resolvedEpNumber,
      title: anime.title.english || anime.title.romaji,
      romajiTitle: anime.title.romaji,
      format: anime.format,
    })
      .then((res) => {
        if (active) setAudioAvailability(res);
      })
      .finally(() => {
        if (active) setCheckingAudio(false);
      });
    return () => {
      active = false;
    };
  }, [animeId, effectiveMalId, resolvedEpNumber, anime]);

  const episodeKey = `${animeId}:${effectiveEpisodeId || decodedEpisodeId}:${selectedServer}:${audioMode}`;
  const streamRequestIdRef = useRef(0);
  const fetchedServersEpRef = useRef('');

  const animeTitle = anime ? anime.title.english || anime.title.romaji : '';
  const animeRomajiTitle = anime?.title.romaji || '';
  const animeFormat = anime?.format;
  const animeSeasonYear = anime?.seasonYear;
  const hasAnimeMeta = Boolean(anime);

  const loadStream = useCallback(async () => {
    const epIdToUse = effectiveEpisodeId || decodedEpisodeId;
    if (!epIdToUse || epIdToUse === 'EPISODE_ID') return;

    // Allow SUB playback to start immediately using URL episodeId while anime metadata/episodes load in parallel;
    // wait for metadata only for DUB (needs dubId) or Hindi (needs anime titles for AnimeWorld search).
    const requiresMetadataBeforeStream = audioMode !== 'sub';
    if (requiresMetadataBeforeStream && !hasAnimeMeta && loadingEpisodes && !animeLoadError) {
      setLoadingStream(true);
      return;
    }

    const useAnimeWorld = audioMode === 'hindi';
    if (useAnimeWorld && !hasAnimeMeta) {
      if (animeLoadError) {
        setStreamData(null);
        setStreamError({
          endpointUrl: resolveApiUrl('/api/anime-world-india/v1/search.php'),
          message: `Cannot query AnimeWorld India because anime metadata failed to load: ${animeLoadError}`,
        });
        setLoadingStream(false);
      } else {
        setLoadingStream(true);
      }
      return;
    }

    const requestId = ++streamRequestIdRef.current;
    setLoadingStream(true);
    setStreamError(null);

    if (useAnimeWorld && hasAnimeMeta) {
      const awRes = await resolveAnimeWorldStreamForAnime({
        title: animeTitle,
        romajiTitle: animeRomajiTitle,
        format: animeFormat,
        seasonYear: animeSeasonYear,
        episodeNumber: resolvedEpNumber,
        preferHindi: true,
        preferLang: 'hindi',
      });

      if (streamRequestIdRef.current !== requestId) return;
      setServers(HINDI_FALLBACK_SERVERS);

      if (awRes.data) {
        setStreamData(awRes.data);
        setStreamError(null);
      } else {
        setStreamData(null);
        setStreamError(
          awRes.error || {
            statusCode: 404,
            endpointUrl: resolveApiUrl('/api/anime-world-india/v1/stream.php'),
            message: 'AnimeWorld India returned no playable source for this episode.',
          }
        );
      }
      setLoadingStream(false);
      return;
    }

    const shouldFetchServers = fetchedServersEpRef.current !== epIdToUse;
    const [streamRes, serverList] = await Promise.all([
      fetchEpisodeStream(epIdToUse, {
        server: selectedServer || 'vidstreaming',
        category: audioMode,
        anilistId: animeId,
        malId: malIdRef.current,
        episodeNumber: resolvedEpNumber,
      }),
      shouldFetchServers ? fetchEpisodeServers(epIdToUse) : Promise.resolve<StreamServer[] | null>(null),
    ]);

    if (streamRequestIdRef.current !== requestId) return;

    if (serverList !== null) {
      fetchedServersEpRef.current = epIdToUse;
      if (serverList.length > 0) {
        setServers(ensureStandardServers(serverList));
      } else if (streamRes.data?.servers?.length) {
        setServers(ensureStandardServers(streamRes.data.servers));
      } else {
        setServers(SUB_DUB_FALLBACK_SERVERS);
      }
    } else if (streamRes.data?.servers?.length) {
      setServers(ensureStandardServers(streamRes.data.servers));
    }

    if (streamRes.data) {
      setStreamData(streamRes.data);
      setStreamError(null);
    } else {
      setStreamData(null);
      setStreamError(
        streamRes.error || {
          endpointUrl: '',
          message: 'Unable to load stream.',
        }
      );
    }
    setLoadingStream(false);
  }, [
    effectiveEpisodeId,
    decodedEpisodeId,
    selectedServer,
    audioMode,
    animeId,
    hasAnimeMeta,
    loadingEpisodes,
    animeTitle,
    animeRomajiTitle,
    animeFormat,
    animeSeasonYear,
    animeLoadError,
    resolvedEpNumber,
  ]);

  const refreshStream = useCallback(async (): Promise<boolean> => {
    const epIdToUse = effectiveEpisodeId || decodedEpisodeId;
    if (!epIdToUse || epIdToUse === 'EPISODE_ID') return false;

    if (audioMode === 'hindi') {
      if (!hasAnimeMeta) return false;
      const awRes = await resolveAnimeWorldStreamForAnime({
        title: animeTitle,
        romajiTitle: animeRomajiTitle,
        format: animeFormat,
        seasonYear: animeSeasonYear,
        episodeNumber: resolvedEpNumber,
        preferHindi: true,
        preferLang: 'hindi',
      });
      if (awRes.data) {
        setStreamData(awRes.data);
        setStreamError(null);
        return true;
      }
      return false;
    }

    const streamRes = await fetchEpisodeStream(epIdToUse, {
      server: selectedServer || 'vidstreaming',
      category: audioMode,
      anilistId: animeId,
      malId: malIdRef.current,
      episodeNumber: resolvedEpNumber,
    });
    if (streamRes.data) {
      setStreamData(streamRes.data);
      setStreamError(null);
      return true;
    }
    return false;
  }, [
    effectiveEpisodeId,
    decodedEpisodeId,
    selectedServer,
    audioMode,
    animeId,
    hasAnimeMeta,
    animeTitle,
    animeRomajiTitle,
    animeFormat,
    animeSeasonYear,
    resolvedEpNumber,
  ]);

  useEffect(() => {
    loadStream();
    window.scrollTo({ top: 0 });
  }, [loadStream]);

  // Save initial watch entry when episode opens
  useEffect(() => {
    if (!anime || !effectiveEpisodeId) return;
    const existing = getHistoryForAnime(anime.id);
    const sameEpisode = existing && existing.episodeNumber === resolvedEpNumber;

    saveWatchProgress({
      animeId: anime.id,
      title: getDisplayTitle(anime.title),
      coverImage: anime.coverImage?.large || anime.coverImage?.extraLarge || '',
      episodeId: effectiveEpisodeId,
      episodeNumber: resolvedEpNumber,
      episodeTitle: currentEpisode?.title,
      progressSeconds: sameEpisode ? existing.progressSeconds : 0,
      durationSeconds: sameEpisode ? existing.durationSeconds : 0,
      audioMode,
      serverName: selectedServer || 'Flix4U Global',
    });
  }, [anime?.id, effectiveEpisodeId, resolvedEpNumber, audioMode, selectedServer]);

  const prevEpisode = currentEpisodeIndex > 0 ? episodes[currentEpisodeIndex - 1] : undefined;
  const nextEpisode =
    currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1
      ? episodes[currentEpisodeIndex + 1]
      : undefined;

  const goToEpisode = useCallback(
    (ep: EpisodeItem) => {
      const targetId = audioMode === 'dub' && ep.dubId ? ep.dubId : ep.id;
      navigate(`/watch/${animeId}/${encodeURIComponent(targetId)}?ep=${ep.number}`);
    },
    [animeId, audioMode, navigate]
  );

  const filteredEpisodes = useMemo(() => {
    const q = epFilter.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter(
      (ep) => String(ep.number).includes(q) || ep.title.toLowerCase().includes(q)
    );
  }, [episodes, epFilter]);

  const displayTitle = anime ? getDisplayTitle(anime.title) : 'Loading...';
  const epNumber = resolvedEpNumber;
  const epTitle = currentEpisode?.title || `Episode ${epNumber}`;
  const historyForAnime = getHistoryForAnime(animeId);
  const initialTime =
    historyForAnime && historyForAnime.episodeNumber === epNumber
      ? historyForAnime.progressSeconds
      : 0;

  const sessionLogId = useMemo(() => {
    const safeEp = String(effectiveEpisodeId || epNumber)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 32);
    return `wl_${animeId}_${epNumber}_${safeEp}_${Date.now()}`.slice(0, 120);
  }, [animeId, effectiveEpisodeId, epNumber]);

  const { handleHeartbeat } = useWatchSessionHeartbeat({
    animeId: anime?.id || animeId,
    animeTitle: displayTitle,
    episodeNumber: epNumber,
    episodeTitle: epTitle,
    serverName: selectedServer || 'Flix4U Global',
  });

  const detectedLangsLower = useMemo(
    () => (streamData?.audioLanguages || []).map((l) => l.toLowerCase()),
    [streamData?.audioLanguages]
  );

  const isAnimeWorldSelected = selectedServer.toLowerCase() === 'animeworld-india';
  const currentDownloadId = `${animeId}-${effectiveEpisodeId}`;

  useEffect(() => {
    const syncDownload = () => {
      setCurrentDownload(getDownloadById(currentDownloadId) || null);
    };
    syncDownload();
    window.addEventListener('flix4u:downloads-updated', syncDownload);
    return () => window.removeEventListener('flix4u:downloads-updated', syncDownload);
  }, [currentDownloadId]);

  useEffect(() => {
    setDownloadNotice(null);
  }, [episodeKey]);

  const handleDownloadCurrentEpisode = useCallback(() => {
    const existing = getDownloadById(currentDownloadId);
    if (existing?.status === 'completed') {
      setOfflinePlayerItem(existing);
      return;
    }
    if (
      existing &&
      (existing.status === 'downloading' ||
        existing.status === 'queued' ||
        existing.status === 'paused')
    ) {
      setShowDownloadManager(true);
      return;
    }

    const selection = selectDownloadableSource(streamData);
    if (!selection.ok) {
      setDownloadNotice({
        message: selection.message,
        canFallbackToSub: selection.reason === 'embed-only' && audioMode === 'hindi',
      });
      return;
    }

    setDownloadNotice(null);
    void startDownloadEpisode({
      id: currentDownloadId,
      animeId,
      animeTitle: displayTitle,
      coverImage: anime?.coverImage?.large || anime?.coverImage?.extraLarge || '',
      episodeId: effectiveEpisodeId,
      episodeNumber: epNumber,
      episodeTitle: epTitle,
      audioMode,
      streamUrl: selection.candidate.url,
      format: selection.candidate.format,
      quality: selection.candidate.quality,
      referer: selection.candidate.referer,
      serverName: selectedServer || 'vidstreaming',
      refreshContext:
        audioMode === 'hindi' || isAnimeWorldSelected
          ? {
              kind: 'animeworld',
              episodeId: effectiveEpisodeId,
              episodeNumber: epNumber,
              audioMode,
              title: animeTitle || undefined,
              romajiTitle: animeRomajiTitle || undefined,
              format: animeFormat,
              seasonYear: animeSeasonYear,
            }
          : {
              kind: 'standard',
              episodeId: effectiveEpisodeId,
              anilistId: animeId,
              malId: malIdRef.current,
              episodeNumber: epNumber,
              server: selectedServer || 'vidstreaming',
              audioMode,
            },
      fileSize: 0,
    });
    setShowDownloadManager(true);
  }, [
    currentDownloadId,
    streamData,
    audioMode,
    animeId,
    displayTitle,
    anime,
    effectiveEpisodeId,
    epNumber,
    epTitle,
    selectedServer,
    isAnimeWorldSelected,
    animeTitle,
    animeRomajiTitle,
    animeFormat,
    animeSeasonYear,
  ]);

  const downloadSelection = useMemo(() => selectDownloadableSource(streamData), [streamData]);

  const downloadButtonLabel = useMemo(() => {
    if (currentDownload) {
      if (currentDownload.status === 'completed') return 'Play Offline';
      if (currentDownload.status === 'downloading') return `Downloading ${currentDownload.progress}%`;
      if (currentDownload.status === 'queued') return 'Queued';
      if (currentDownload.status === 'paused') return `Paused ${currentDownload.progress}%`;
      if (currentDownload.status === 'unsupported' && !downloadSelection.ok) {
        return 'Download Not Supported';
      }
      if (currentDownload.status === 'error') return 'Retry Download';
    }
    if (streamData && !downloadSelection.ok && downloadSelection.reason === 'embed-only') {
      return 'Download Not Supported';
    }
    return 'Download';
  }, [currentDownload, streamData, downloadSelection]);

  const hasJapaneseAvailable = useMemo(() => {
    if (streamData && streamData.sources.length > 0 && audioMode === 'sub') return true;
    if (audioAvailability?.sub?.available) return true;
    if (streamError?.statusCode === 404 && audioMode === 'sub') return false;
    return true;
  }, [streamData, audioAvailability, audioMode, streamError]);

  const hasEnglishAvailable = useMemo(() => {
    if (streamData && streamData.sources.length > 0 && audioMode === 'dub') return true;
    if (audioAvailability?.dub?.available) return true;
    if (currentEpisode?.hasDub) return true;
    if (streamError?.statusCode === 404 && audioMode === 'dub') return false;
    return true;
  }, [streamData, audioAvailability, audioMode, streamError, currentEpisode]);

  const hasHindiAvailable = useMemo(() => {
    if (streamData && streamData.sources.length > 0 && audioMode === 'hindi') return true;
    if (streamData?.hasHindiAudio) return true;
    if (audioAvailability?.hindi?.available) return true;
    if (streamError?.statusCode === 404 && audioMode === 'hindi') return false;
    return true;
  }, [streamData, audioAvailability, audioMode, streamError]);

  const extraAdaptedExtensions = useMemo(() => {
    const standardNames = new Set(servers.map((s) => s.name.toLowerCase()));
    return adaptedExtensions.filter((ext) => {
      const extNameLower = ext.name.toLowerCase();
      if (standardNames.has(extNameLower)) return false;
      if (
        extNameLower.includes('hianime') ||
        extNameLower.includes('zoro') ||
        extNameLower.includes('aniwatch') ||
        extNameLower.includes('kaido') ||
        extNameLower.includes('animepahe')
      ) {
        return false;
      }
      return true;
    });
  }, [adaptedExtensions, servers]);

  const handleSelectAudioMode = useCallback(
    (mode: 'sub' | 'dub' | 'hindi') => {
      setAudioMode(mode);
      updatePreferences({ preferredAudio: mode });
      if (mode === 'hindi') {
        setSelectedServer('animeworld-india');
      } else if (selectedServer.toLowerCase() === 'animeworld-india') {
        setSelectedServer('vidstreaming');
      }
    },
    [selectedServer, updatePreferences]
  );

  const selectedTrackStatus = audioAvailability ? audioAvailability[audioMode] : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/anime/${animeId}`}
          className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="truncate max-w-[200px] sm:max-w-md">{displayTitle}</span>
        </Link>

        {anime && (
          <button
            type="button"
            onClick={() => toggleWatchlist(anime)}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold ${
              isInWatchlist(anime.id) ? 'kuro-btn-active' : 'kuro-btn-glass'
            }`}
          >
            {isInWatchlist(anime.id) ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
            <span>{isInWatchlist(anime.id) ? 'Saved' : 'Watchlist'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Primary Player Column */}
        <div className="space-y-4 sm:space-y-5 min-w-0">
          <VideoPlayer
            streamData={streamData}
            streamError={streamError}
            loading={loadingStream}
            episodeKey={episodeKey}
            logicalEpisodeKey={`${animeId}:${resolvedEpNumber}:${audioMode}`}
            episodeTitle={`${displayTitle} — Episode ${epNumber}`}
            initialTime={initialTime}
            autoNext={autoNext}
            hasNextEpisode={Boolean(nextEpisode)}
            audioMode={audioMode}
            onSelectAudioMode={handleSelectAudioMode}
            servers={servers}
            selectedServer={selectedServer}
            onSelectServer={setSelectedServer}
            skipIntro={aniSkipData?.intro || streamData?.intro}
            skipOutro={aniSkipData?.outro || streamData?.outro}
            skipRecap={aniSkipData?.recap || streamData?.recap}
            onNextEpisode={nextEpisode ? () => goToEpisode(nextEpisode) : undefined}
            onPreviousEpisode={prevEpisode ? () => goToEpisode(prevEpisode) : undefined}
            onProgress={(progressSeconds, durationSeconds) => {
              if (!anime) return;
              saveWatchProgress({
                animeId: anime.id,
                title: displayTitle,
                coverImage: anime.coverImage?.large || anime.coverImage?.extraLarge || '',
                episodeId: effectiveEpisodeId,
                episodeNumber: epNumber,
                episodeTitle: epTitle,
                progressSeconds,
                durationSeconds,
                audioMode,
                serverName: selectedServer || 'Flix4U Global',
              });
            }}
            onPlaybackTime={(watchedSecondsDelta, cur, dur, completedEpisode) => {
              if (!anime) return;
              void recordWatchPlayback({
                animeKey: `anilist:${anime.id}`,
                animeId: anime.id,
                episodeNumber: epNumber,
                episodeKey: effectiveEpisodeId,
                sessionLogId,
                animeTitle: displayTitle,
                coverImage: anime.coverImage?.large || anime.coverImage?.extraLarge || '',
                episodeTitle: epTitle,
                serverName: selectedServer || 'Flix4U Global',
                audioMode,
                progressSeconds: cur,
                durationSeconds: dur,
                secondsWatched: watchedSecondsDelta,
                completed: completedEpisode,
              });
            }}
            onPlaybackHeartbeat={handleHeartbeat}
            onRefreshStream={refreshStream}
            onRetry={loadStream}
            onDownload={handleDownloadCurrentEpisode}
            downloadStatusLabel={downloadButtonLabel}
            isDownloading={currentDownload?.status === 'downloading'}
          />

          {/* Facebook Community Section Banner */}
          <div className="kuro-fb-banner relative overflow-hidden rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4">
            <div
              aria-hidden="true"
              className="kuro-fb-banner-glow pointer-events-none absolute -inset-x-6 -inset-y-4"
              style={{
                background:
                  'radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.28) 0%, rgba(37, 99, 235, 0.09) 45%, transparent 75%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/40 bg-blue-600/20 text-blue-400 shadow-[0_0_20px_-3px_rgba(59,130,246,0.55)]">
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Join Our Facebook Group
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                    Join the Flix4U community for updates, announcements and support.
                  </p>
                </div>
              </div>
              <a
                href="https://facebook.com/groups/4577806405820098/"
                target={isNativeCapacitorRuntime() ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="kuro-btn-primary inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-900/30"
              >
                <span>Join Group</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Playback Troubleshooting Notice Banner */}
          <div
            role="note"
            aria-label="⚠ যদি ভিডিও লোড না হয়, 1.1.1.1 VPN ব্যবহার করবেন"
            className="kuro-vpn-notice relative overflow-hidden rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5"
          >
            <div
              aria-hidden="true"
              className="kuro-vpn-notice-glow pointer-events-none absolute -inset-x-6 -inset-y-4"
              style={{
                background:
                  'radial-gradient(circle at 12% 50%, rgba(251, 191, 36, 0.24) 0%, rgba(245, 158, 11, 0.08) 44%, transparent 74%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent"
            />
            <div className="relative z-10 flex items-center gap-3 sm:gap-3.5">
              <div
                aria-hidden="true"
                className="kuro-vpn-icon-pulse flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/15 text-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.55)]"
              >
                <AlertTriangle className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </div>
              <p className="min-w-0 flex-1 text-[13px] sm:text-sm font-medium leading-relaxed text-amber-50/95">
                <span className="text-amber-300 font-semibold">⚠ </span>
                যদি ভিডিও লোড না হয়,{' '}
                <strong className="font-bold text-sky-300 tracking-wide drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]">
                  1.1.1.1 VPN
                </strong>{' '}
                ব্যবহার করবেন
              </p>
            </div>
          </div>

          {/* Episode Bar + Prev/Next + Auto Next */}
          <div className="kuro-glass flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-violet-300 tabular-nums">
                <span className="font-semibold">Episode {epNumber}</span>
                {currentEpisode?.airDate && (
                  <span className="text-slate-400">· Aired {currentEpisode.airDate}</span>
                )}
                {currentEpisode?.runtime && (
                  <span className="text-slate-400">· {currentEpisode.runtime}m</span>
                )}
                {aniSkipData?.found && (
                  <span className="text-emerald-400">· AniSkip Active</span>
                )}
                {streamData?.hasHindiAudio && (
                  <span className="text-emerald-400">· Hindi Audio Verified</span>
                )}
                {streamData && streamData.hasHindiAudio === false && audioMode === 'hindi' && (
                  <span className="text-amber-400">· Hindi Dub Not Available</span>
                )}
              </div>
              <h1 className="truncate text-base sm:text-lg font-bold text-white">{epTitle}</h1>
              {currentEpisode?.description && (
                <p className="line-clamp-2 text-xs text-slate-400 leading-relaxed">
                  {currentEpisode.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadCurrentEpisode}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                  currentDownload?.status === 'completed'
                    ? 'kuro-btn-active text-emerald-200'
                    : downloadButtonLabel === 'Download Not Supported'
                      ? 'kuro-btn-glass border-amber-400/35 text-amber-200'
                      : 'kuro-btn-glass text-violet-200'
                }`}
              >
                {currentDownload?.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : currentDownload?.status === 'downloading' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                ) : downloadButtonLabel === 'Download Not Supported' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>{downloadButtonLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDownloadManager(true)}
                className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !autoNext;
                  setAutoNext(next);
                  updatePreferences({ autoNext: next });
                }}
                className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-semibold ${
                  autoNext ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                }`}
              >
                Auto Next: {autoNext ? 'On' : 'Off'}
              </button>

              <button
                type="button"
                disabled={!prevEpisode}
                onClick={() => prevEpisode && goToEpisode(prevEpisode)}
                className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                disabled={!nextEpisode}
                onClick={() => nextEpisode && goToEpisode(nextEpisode)}
                className="kuro-btn-primary inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {downloadNotice && (
            <div className="kuro-glass flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
              <p className="leading-relaxed">{downloadNotice.message}</p>
              <div className="flex items-center gap-2 shrink-0">
                {downloadNotice.canFallbackToSub && (
                  <button
                    type="button"
                    onClick={() => handleSelectAudioMode('sub')}
                    className="kuro-btn-primary min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                  >
                    Switch to SUB Server
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDownloadNotice(null)}
                  aria-label="Dismiss download notice"
                  className="kuro-btn-glass flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Audio Language & Server Selector Card */}
          <div className="kuro-glass rounded-3xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Languages className="h-3.5 w-3.5 text-violet-400" />
                  <span>Audio Language:</span>
                </span>
                <div className="kuro-segment-track inline-flex flex-wrap rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectAudioMode('sub')}
                    title={audioAvailability?.sub.reason || 'Japanese (SUB)'}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold ${
                      audioMode === 'sub' ? 'kuro-segment-active' : 'kuro-segment-idle'
                    } ${hasJapaneseAvailable === false ? 'opacity-65' : ''}`}
                  >
                    <span>Japanese (SUB)</span>
                    {hasJapaneseAvailable === true && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Available" />
                    )}
                    {hasJapaneseAvailable === false && (
                      <span className="text-[10px] font-normal text-rose-300">(Unavailable)</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectAudioMode('dub')}
                    title={audioAvailability?.dub.reason || 'English (DUB)'}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold ${
                      audioMode === 'dub' ? 'kuro-segment-active' : 'kuro-segment-idle'
                    } ${hasEnglishAvailable === false ? 'opacity-65' : ''}`}
                  >
                    <span>English (DUB)</span>
                    {hasEnglishAvailable === true && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Available" />
                    )}
                    {hasEnglishAvailable === false && (
                      <span className="text-[10px] font-normal text-rose-300">(Unavailable)</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectAudioMode('hindi')}
                    title={audioAvailability?.hindi.reason || 'Hindi (DUB)'}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold ${
                      audioMode === 'hindi' ? 'kuro-segment-amber' : 'kuro-segment-idle'
                    } ${hasHindiAvailable === false ? 'opacity-65' : ''}`}
                  >
                    <span>Hindi (DUB)</span>
                    {hasHindiAvailable === true && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Available" />
                    )}
                    {hasHindiAvailable === false && (
                      <span className="text-[10px] font-normal text-rose-300">(Unavailable)</span>
                    )}
                  </button>
                </div>
                {checkingAudio && !audioAvailability && (
                  <span className="text-[11px] text-slate-400">Checking tracks...</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowShortcuts((v) => !v)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  showShortcuts ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>Shortcuts</span>
              </button>
            </div>

            {selectedTrackStatus && !selectedTrackStatus.available && selectedTrackStatus.reason && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                {selectedTrackStatus.reason}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 mr-1">
                  <Server className="h-3.5 w-3.5 text-violet-400" />
                  <span>Servers:</span>
                </span>
                {(audioMode === 'hindi'
                  ? HINDI_FALLBACK_SERVERS
                  : (servers.length > 0 ? servers : SUB_DUB_FALLBACK_SERVERS).filter(
                      (srv) => !srv.name.toLowerCase().includes('animeworld')
                    )
                ).map((srv) => {
                  const isSelected =
                    (selectedServer || servers[0]?.name || 'vidstreaming').toLowerCase() ===
                    srv.name.toLowerCase();
                  return (
                    <button
                      key={srv.name}
                      type="button"
                      onClick={() => setSelectedServer(srv.name)}
                      className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize ${
                        isSelected ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                      }`}
                    >
                      {srv.name}
                    </button>
                  );
                })}

                {audioMode !== 'hindi' && extraAdaptedExtensions.map((ext) => {
                  const extServerKey = (ext.adapterServer || ext.name).toLowerCase();
                  if (extServerKey.includes('animeworld')) return null;
                  const isSelected = selectedServer.toLowerCase() === extServerKey;
                  return (
                    <button
                      key={ext.id}
                      type="button"
                      onClick={() => setSelectedServer(extServerKey)}
                      title={ext.limitationReason}
                      className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-semibold ${
                        isSelected ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                      }`}
                    >
                      {ext.name}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowSourceManager(true)}
                className="kuro-btn-glass inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200"
              >
                <Package className="h-3.5 w-3.5" />
                <span>Manage Sources</span>
              </button>
            </div>

            {showShortcuts && (
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3 text-xs text-slate-400 sm:grid-cols-3">
                <p>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">
                    Space / K
                  </kbd>{' '}
                  Play / Pause
                </p>
                <p>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">
                    F
                  </kbd>{' '}
                  Fullscreen
                </p>
                <p>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">
                    M
                  </kbd>{' '}
                  Mute / Unmute
                </p>
                <p>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">
                    ← / →
                  </kbd>{' '}
                  Seek ±10s
                </p>
                <p>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">
                    N / P
                  </kbd>{' '}
                  Next / Prev Ep
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Episode Selector Sidebar */}
        <aside className="kuro-glass rounded-3xl p-4 flex flex-col max-h-[680px]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white">Episodes</h2>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {episodes.length} total
            </span>
          </div>

          {episodes.length > 10 && (
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={epFilter}
                onChange={(e) => setEpFilter(e.target.value)}
                placeholder="Filter episode..."
                aria-label="Filter episodes"
                className="h-9 w-full rounded-xl border border-white/[0.1] bg-[#07080d]/85 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {loadingEpisodes && episodes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Loading episode directory...
              </p>
            ) : episodes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No episodes available for this title.
              </p>
            ) : filteredEpisodes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No matching episodes.
              </p>
            ) : (
              filteredEpisodes.map((ep) => {
                const active = ep.number === epNumber;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => goToEpisode(ep)}
                    className={`flex w-full min-h-[50px] items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left ${
                      active ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-semibold text-violet-300 tabular-nums">
                        EP {ep.number}
                      </span>
                      <p className="truncate text-xs font-medium mt-0.5">{ep.title}</p>
                    </div>
                    {active && (
                      <span className="text-[11px] font-semibold text-violet-200 shrink-0">
                        Playing
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {showSourceManager && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Anime Source & Extension Manager"
        >
          <div className="kuro-glass-elevated flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">Anime Sources &amp; Extensions</h2>
                <p className="text-xs text-slate-400">
                  Manage Aniyomi &amp; Tachiyomi repositories and backend-adapted sources
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSourceManager(false)}
                aria-label="Close source manager"
                className="kuro-btn-glass flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[#10121c]" />}>
                <ExtensionManager compact />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {showDownloadManager && (
        <Suspense fallback={null}>
          <DownloadManagerModal
            isOpen={showDownloadManager}
            onClose={() => setShowDownloadManager(false)}
            onPlayOffline={(item) => setOfflinePlayerItem(item)}
          />
        </Suspense>
      )}

      {offlinePlayerItem && (
        <Suspense fallback={null}>
          <OfflinePlayerModal
            item={offlinePlayerItem}
            onClose={() => setOfflinePlayerItem(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
