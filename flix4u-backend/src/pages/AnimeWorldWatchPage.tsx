import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Languages,
  Loader2,
  Play,
  Search,
  Server,
  X,
} from 'lucide-react';
import { DownloadManagerModal } from '@/src/components/DownloadManagerModal';
import { OfflinePlayerModal } from '@/src/components/OfflinePlayerModal';
import { VideoPlayer } from '@/src/components/VideoPlayer';
import { useWatchSessionHeartbeat } from '@/src/hooks/useWatchSessionHeartbeat';
import { isNativeCapacitorRuntime, resolveApiUrl } from '@/src/config/env';
import { useAuth } from '@/src/context/AuthContext';
import {
  fetchAnimeWorldEpisodes,
  fetchAnimeWorldSeasons,
  fetchAnimeWorldStream,
  parseAnimeWorldStreamToResult,
} from '@/src/services/animeWorldApi';
import {
  getDownloadById,
  selectDownloadableSource,
  startDownloadEpisode,
  type DownloadItem,
} from '@/src/services/downloadService';
import type {
  AnimeWorldEpisode,
  AnimeWorldSeason,
  AnimeWorldStreamResponse,
  ParsedStreamResult,
  StreamFetchError,
} from '@/src/types/anime';

function parseEpisodeNum(ep: AnimeWorldEpisode, idx: number): number {
  const m =
    ep.episodeNumber?.match(/(\d+)/) ||
    ep.episodeId?.match(/\d+x(\d+)/i) ||
    ep.episodeId?.match(/episode[-_]?(\d+)/i);
  return m ? Number(m[1]) : idx + 1;
}

function stableNumericId(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 900001;
}

export const AnimeWorldWatchPage: React.FC = () => {
  const { kind, contentId } = useParams<{ kind: string; contentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isMovie = kind === 'movie';
  const decodedContentId = contentId ? decodeURIComponent(contentId) : '';
  const seriesIdParam = searchParams.get('seriesId') || '';
  const seasonIdParam = searchParams.get('seasonId') || '';
  const epParam = Number(searchParams.get('ep') || 0);
  const langParam = (searchParams.get('lang') || 'hindi').toLowerCase();
  const requestedLang: 'hindi' | 'sub' | 'dub' =
    langParam === 'sub' ? 'sub' : langParam === 'dub' ? 'dub' : 'hindi';

  const {
    preferences,
    updatePreferences,
    recordWatchPlayback,
    saveWatchProgress,
    getHistoryForAnime,
  } = useAuth();
  const [autoNext, setAutoNext] = useState<boolean>(preferences.autoNext);

  const [rawStreamMeta, setRawStreamMeta] = useState<AnimeWorldStreamResponse | null>(null);
  const [streamData, setStreamData] = useState<ParsedStreamResult | null>(null);
  const [streamError, setStreamError] = useState<StreamFetchError | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);

  const [episodes, setEpisodes] = useState<AnimeWorldEpisode[]>([]);
  const [seasons, setSeasons] = useState<AnimeWorldSeason[]>([]);
  const [seriesPoster, setSeriesPoster] = useState<string | null>(null);
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [epFilter, setEpFilter] = useState('');
  const [showDownloadManager, setShowDownloadManager] = useState(false);
  const [offlinePlayerItem, setOfflinePlayerItem] = useState<DownloadItem | null>(null);
  const [currentDownload, setCurrentDownload] = useState<DownloadItem | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const requestCounterRef = useRef(0);

  const loadStream = useCallback(async () => {
    if (!decodedContentId) return;
    const reqId = ++requestCounterRef.current;
    setLoadingStream(true);
    setStreamError(null);

    const res = await fetchAnimeWorldStream({
      ...(isMovie ? { movieId: decodedContentId } : { episodeId: decodedContentId }),
      lang: requestedLang,
    });

    if (requestCounterRef.current !== reqId) return;

    if (res.status >= 400 || !res.data?.success) {
      setRawStreamMeta(null);
      setStreamData(null);
      setStreamError({
        statusCode: res.status || 404,
        endpointUrl: res.endpointUrl || resolveApiUrl('/api/anime-world-india/v1/stream.php'),
        message:
          res.data?.error ||
          `AnimeWorld India stream returned HTTP ${res.status || 502}.`,
      });
      setLoadingStream(false);
      return;
    }

    const parsed = parseAnimeWorldStreamToResult(res.data, res.endpointUrl, requestedLang);
    if (!parsed.data) {
      setRawStreamMeta(res.data);
      setStreamData(null);
      setStreamError(
        parsed.error || {
          statusCode: 404,
          endpointUrl: res.endpointUrl,
          message: 'AnimeWorld India returned no playable stream link.',
        }
      );
      setLoadingStream(false);
      return;
    }

    setRawStreamMeta(res.data);
    setStreamData(parsed.data);
    setStreamError(null);
    setLoadingStream(false);
  }, [decodedContentId, isMovie, requestedLang]);

  const refreshStream = useCallback(async (): Promise<boolean> => {
    if (!decodedContentId) return false;
    const res = await fetchAnimeWorldStream({
      ...(isMovie ? { movieId: decodedContentId } : { episodeId: decodedContentId }),
      lang: requestedLang,
    });
    if (res.status >= 400 || !res.data?.success) return false;
    const parsed = parseAnimeWorldStreamToResult(res.data, res.endpointUrl, requestedLang);
    if (!parsed.data) return false;
    setRawStreamMeta(res.data);
    setStreamData(parsed.data);
    setStreamError(null);
    return true;
  }, [decodedContentId, isMovie, requestedLang]);

  useEffect(() => {
    loadStream();
    window.scrollTo({ top: 0 });
  }, [loadStream]);

  // Load season & episode sidebar context for series episodes
  useEffect(() => {
    if (isMovie || (!seriesIdParam && !seasonIdParam)) {
      setEpisodes([]);
      return;
    }
    let active = true;
    const loadDirectory = async () => {
      setLoadingEpisodes(true);
      try {
        if (seriesIdParam) {
          const seasonsRes = await fetchAnimeWorldSeasons(seriesIdParam);
          if (active && seasonsRes.data?.success) {
            setSeasons(seasonsRes.data.seasons || []);
            setSeriesPoster(seasonsRes.data.series.poster || null);
            setSeriesTitle(seasonsRes.data.series.title || '');
          }
        }
        if (seasonIdParam) {
          const epsRes = await fetchAnimeWorldEpisodes(seasonIdParam);
          if (active && epsRes.data?.success) {
            setEpisodes(epsRes.data.episodes || []);
          }
        }
      } catch {
        // non-fatal sidebar error
      } finally {
        if (active) setLoadingEpisodes(false);
      }
    };
    loadDirectory();
    return () => {
      active = false;
    };
  }, [isMovie, seriesIdParam, seasonIdParam]);

  const currentEpIndex = useMemo(
    () => episodes.findIndex((ep) => ep.episodeId === decodedContentId),
    [episodes, decodedContentId]
  );

  const prevEpisode = currentEpIndex > 0 ? episodes[currentEpIndex - 1] : undefined;
  const nextEpisode =
    currentEpIndex >= 0 && currentEpIndex < episodes.length - 1
      ? episodes[currentEpIndex + 1]
      : undefined;

  const goToEpisode = useCallback(
    (ep: AnimeWorldEpisode, idx?: number) => {
      const num = parseEpisodeNum(ep, idx ?? 0);
      const nextParams = new URLSearchParams();
      if (seriesIdParam) nextParams.set('seriesId', seriesIdParam);
      if (seasonIdParam) nextParams.set('seasonId', seasonIdParam);
      nextParams.set('ep', String(num));
      nextParams.set('lang', requestedLang);
      navigate(
        `/animeworld-india/watch/episode/${encodeURIComponent(ep.episodeId)}?${nextParams.toString()}`
      );
    },
    [navigate, seriesIdParam, seasonIdParam, requestedLang]
  );

  const handleSelectLanguage = (nextLang: 'hindi' | 'sub' | 'dub') => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('lang', nextLang);
    setSearchParams(nextParams);
  };

  const handleSeasonSwitch = async (season: AnimeWorldSeason) => {
    setLoadingEpisodes(true);
    try {
      const epsRes = await fetchAnimeWorldEpisodes(season.seasonId);
      if (epsRes.data?.success && epsRes.data.episodes.length > 0) {
        const firstEp = epsRes.data.episodes[0];
        const nextParams = new URLSearchParams();
        if (seriesIdParam) nextParams.set('seriesId', seriesIdParam);
        nextParams.set('seasonId', season.seasonId);
        nextParams.set('ep', String(parseEpisodeNum(firstEp, 0)));
        nextParams.set('lang', requestedLang);
        navigate(
          `/animeworld-india/watch/episode/${encodeURIComponent(firstEp.episodeId)}?${nextParams.toString()}`
        );
      }
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const filteredEpisodes = useMemo(() => {
    const q = epFilter.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        ep.episodeNumber.toLowerCase().includes(q)
    );
  }, [episodes, epFilter]);

  const titleText = rawStreamMeta?.title || seriesTitle || decodedContentId;
  const displayEpLabel = !isMovie && epParam > 0 ? `Episode ${epParam}` : isMovie ? 'Movie' : 'Episode';
  const currentDownloadId = `aw-${decodedContentId}`;
  const downloadSelection = useMemo(() => selectDownloadableSource(streamData), [streamData]);

  const stableAnimeId = useMemo(
    () => stableNumericId(seriesIdParam || decodedContentId),
    [seriesIdParam, decodedContentId]
  );
  const awEpisodeNum = epParam > 0 ? epParam : 1;

  const sessionLogId = useMemo(() => {
    const safeId = decodedContentId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
    return `aw_${stableAnimeId}_${awEpisodeNum}_${safeId}_${Date.now()}`.slice(0, 120);
  }, [stableAnimeId, awEpisodeNum, decodedContentId]);

  const historyForAnime = getHistoryForAnime(stableAnimeId);
  const initialTime =
    historyForAnime && historyForAnime.episodeId === decodedContentId
      ? historyForAnime.progressSeconds
      : 0;

  useEffect(() => {
    if (!decodedContentId) return;
    const existing = getHistoryForAnime(stableAnimeId);
    const sameEpisode = existing && existing.episodeId === decodedContentId;
    void saveWatchProgress({
      animeId: stableAnimeId,
      title: titleText || 'AnimeWorld Series',
      coverImage: rawStreamMeta?.poster || seriesPoster || '',
      episodeId: decodedContentId,
      episodeNumber: awEpisodeNum,
      episodeTitle: displayEpLabel,
      progressSeconds: sameEpisode ? existing.progressSeconds : 0,
      durationSeconds: sameEpisode ? existing.durationSeconds : 0,
      audioMode: requestedLang,
      serverName: 'AnimeWorld India',
    });
  }, [
    decodedContentId,
    stableAnimeId,
    titleText,
    rawStreamMeta?.poster,
    seriesPoster,
    awEpisodeNum,
    displayEpLabel,
    requestedLang,
  ]);

  const { handleHeartbeat } = useWatchSessionHeartbeat({
    animeId: stableAnimeId,
    animeTitle: titleText || 'AnimeWorld Series',
    episodeNumber: awEpisodeNum,
    episodeTitle: displayEpLabel,
    serverName: 'AnimeWorld India',
  });

  useEffect(() => {
    const sync = () => {
      setCurrentDownload(getDownloadById(currentDownloadId) || null);
    };
    sync();
    window.addEventListener('flix4u:downloads-updated', sync);
    return () => window.removeEventListener('flix4u:downloads-updated', sync);
  }, [currentDownloadId]);

  useEffect(() => {
    setDownloadNotice(null);
  }, [decodedContentId, requestedLang]);

  const handleDownload = () => {
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
    if (!downloadSelection.ok) {
      setDownloadNotice(downloadSelection.message);
      return;
    }

    setDownloadNotice(null);
    void startDownloadEpisode({
      id: currentDownloadId,
      animeId: stableNumericId(seriesIdParam || decodedContentId),
      animeTitle: seriesTitle || titleText,
      coverImage: rawStreamMeta?.poster || seriesPoster || '',
      episodeId: decodedContentId,
      episodeNumber: epParam > 0 ? epParam : 1,
      episodeTitle: titleText,
      audioMode: requestedLang,
      streamUrl: downloadSelection.candidate.url,
      format: downloadSelection.candidate.format,
      quality: downloadSelection.candidate.quality,
      referer: downloadSelection.candidate.referer,
      serverName: 'animeworld-india',
      refreshContext: {
        kind: 'animeworld',
        episodeId: isMovie ? '' : decodedContentId,
        movieId: isMovie ? decodedContentId : undefined,
        episodeNumber: epParam > 0 ? epParam : 1,
        audioMode: requestedLang,
        title: seriesTitle || titleText,
      },
      fileSize: 0,
    });
    setShowDownloadManager(true);
  };

  const downloadLabel =
    currentDownload?.status === 'completed'
      ? 'Play Offline'
      : currentDownload?.status === 'downloading'
        ? `Downloading ${currentDownload.progress}%`
        : currentDownload?.status === 'queued'
          ? 'Queued'
          : currentDownload?.status === 'paused'
            ? `Paused ${currentDownload.progress}%`
            : currentDownload?.status === 'unsupported' && !downloadSelection.ok
              ? 'Download Not Supported'
              : currentDownload?.status === 'error'
                ? 'Retry Download'
                : downloadSelection.ok
                  ? 'Download'
                  : streamData
                    ? 'Download Not Supported'
                    : 'Download';

  const backTarget = seriesIdParam
    ? `/animeworld-india/series/${encodeURIComponent(seriesIdParam)}`
    : '/animeworld-india';

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTarget}
          className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="truncate max-w-[220px] sm:max-w-md">
            {seriesTitle || 'AnimeWorld India'}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
            <Server className="h-3.5 w-3.5" />
            <span>AnimeWorld India</span>
          </span>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          !isMovie && (episodes.length > 0 || seasons.length > 0)
            ? 'lg:grid-cols-[1fr_340px]'
            : ''
        }`}
      >
        {/* Main Player Column */}
        <div className="space-y-4 sm:space-y-5 min-w-0">
          <VideoPlayer
            streamData={streamData}
            streamError={streamError}
            loading={loadingStream}
            episodeKey={`aw:${decodedContentId}:${requestedLang}`}
            episodeTitle={`${titleText} — ${displayEpLabel}`}
            initialTime={initialTime}
            autoNext={autoNext}
            hasNextEpisode={Boolean(nextEpisode)}
            audioMode={requestedLang}
            onSelectAudioMode={handleSelectLanguage}
            servers={[{ name: 'animeworld-india' }]}
            onNextEpisode={nextEpisode ? () => goToEpisode(nextEpisode, currentEpIndex + 1) : undefined}
            onPreviousEpisode={prevEpisode ? () => goToEpisode(prevEpisode, currentEpIndex - 1) : undefined}
            onProgress={(progressSeconds, durationSeconds) => {
              void saveWatchProgress({
                animeId: stableAnimeId,
                title: titleText || 'AnimeWorld Series',
                coverImage: rawStreamMeta?.poster || seriesPoster || '',
                episodeId: decodedContentId,
                episodeNumber: awEpisodeNum,
                episodeTitle: displayEpLabel,
                progressSeconds,
                durationSeconds,
                audioMode: requestedLang,
                serverName: 'AnimeWorld India',
              });
            }}
            onPlaybackTime={(watchedSecondsDelta, cur, dur, completedEpisode) => {
              void recordWatchPlayback({
                animeKey: `aw:${seriesIdParam || decodedContentId}`,
                animeId: stableAnimeId,
                episodeNumber: awEpisodeNum,
                episodeKey: decodedContentId,
                sessionLogId,
                animeTitle: titleText || 'AnimeWorld Series',
                coverImage: rawStreamMeta?.poster || seriesPoster || '',
                episodeTitle: displayEpLabel,
                serverName: 'AnimeWorld India',
                audioMode: requestedLang,
                progressSeconds: cur,
                durationSeconds: dur,
                secondsWatched: watchedSecondsDelta,
                completed: completedEpisode,
              });
            }}
            onPlaybackHeartbeat={handleHeartbeat}
            onRefreshStream={refreshStream}
            onRetry={loadStream}
            onDownload={handleDownload}
            downloadStatusLabel={downloadLabel}
            isDownloading={currentDownload?.status === 'downloading'}
          />

          {/* Facebook Community Banner */}
          <div className="kuro-fb-banner relative overflow-hidden rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4">
            <div
              aria-hidden="true"
              className="kuro-fb-banner-glow pointer-events-none absolute -inset-x-6 -inset-y-4"
              style={{
                background:
                  'radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.28) 0%, rgba(37, 99, 235, 0.09) 45%, transparent 75%)',
              }}
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/40 bg-blue-600/20 text-blue-400">
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
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
                className="kuro-btn-primary inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white"
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
            <div className="relative z-10 flex items-center gap-3 sm:gap-3.5">
              <div
                aria-hidden="true"
                className="kuro-vpn-icon-pulse flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/15 text-amber-300"
              >
                <AlertTriangle className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </div>
              <p className="min-w-0 flex-1 text-[13px] sm:text-sm font-medium leading-relaxed text-amber-50/95">
                <span className="text-amber-300 font-semibold">⚠ </span>
                যদি ভিডিও লোড না হয়,{' '}
                <strong className="font-bold text-sky-300 tracking-wide">1.1.1.1 VPN</strong> ব্যবহার করবেন
              </p>
            </div>
          </div>

          {/* Title & Playback Actions Card */}
          <div className="kuro-glass flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-violet-300 tabular-nums">
                <span className="font-semibold">{displayEpLabel}</span>
                {rawStreamMeta?.year && (
                  <span className="text-slate-400">· {rawStreamMeta.year}</span>
                )}
                {rawStreamMeta?.rating && (
                  <span className="text-amber-300">· ★ {rawStreamMeta.rating}</span>
                )}
                {rawStreamMeta?.hasHindiAudio && (
                  <span className="text-emerald-400">· Hindi Audio Verified</span>
                )}
              </div>
              <h1 className="truncate text-base sm:text-lg font-bold text-white">{titleText}</h1>
              {rawStreamMeta?.description && (
                <p className="line-clamp-2 text-xs text-slate-400 leading-relaxed">
                  {rawStreamMeta.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                  currentDownload?.status === 'completed'
                    ? 'kuro-btn-active text-emerald-200'
                    : downloadLabel === 'Download Not Supported'
                      ? 'kuro-btn-glass border-amber-400/35 text-amber-200'
                      : 'kuro-btn-glass text-violet-200'
                }`}
              >
                {currentDownload?.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : currentDownload?.status === 'downloading' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                ) : downloadLabel === 'Download Not Supported' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>{downloadLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDownloadManager(true)}
                className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Queue</span>
              </button>

              {!isMovie && episodes.length > 0 && (
                <>
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
                    onClick={() => prevEpisode && goToEpisode(prevEpisode, currentEpIndex - 1)}
                    className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Prev</span>
                  </button>

                  <button
                    type="button"
                    disabled={!nextEpisode}
                    onClick={() => nextEpisode && goToEpisode(nextEpisode, currentEpIndex + 1)}
                    className="kuro-btn-primary inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {downloadNotice && (
            <div className="kuro-glass flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
              <p className="leading-relaxed">{downloadNotice}</p>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/anime"
                  className="kuro-btn-primary min-h-[36px] inline-flex items-center rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                >
                  Browse SUB/DUB Servers
                </Link>
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

          {/* Language Preference & Server Notice */}
          <div className="kuro-glass rounded-3xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Languages className="h-3.5 w-3.5 text-violet-400" />
                  <span>Preferred Audio:</span>
                </span>
                <div className="kuro-segment-track inline-flex flex-wrap rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('hindi')}
                    className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold ${
                      requestedLang === 'hindi' ? 'kuro-segment-amber' : 'kuro-segment-idle'
                    }`}
                  >
                    Hindi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('sub')}
                    className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold ${
                      requestedLang === 'sub' ? 'kuro-segment-active' : 'kuro-segment-idle'
                    }`}
                  >
                    Japanese (SUB)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('dub')}
                    className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold ${
                      requestedLang === 'dub' ? 'kuro-segment-active' : 'kuro-segment-idle'
                    }`}
                  >
                    English (DUB)
                  </button>
                </div>
              </div>

              <Link
                to="/anime"
                className="kuro-btn-glass inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                <span>Switch to Other Servers</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Episode & Season Sidebar (for Series) */}
        {!isMovie && (episodes.length > 0 || seasons.length > 0) && (
          <aside className="kuro-glass rounded-3xl p-4 flex flex-col max-h-[700px]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white">Episodes</h2>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {episodes.length} total
              </span>
            </div>

            {seasons.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {seasons.map((s) => (
                  <button
                    key={s.seasonId}
                    type="button"
                    onClick={() => handleSeasonSwitch(s)}
                    className={`min-h-[32px] rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      s.seasonId === seasonIdParam ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                    }`}
                  >
                    {s.seasonName}
                  </button>
                ))}
              </div>
            )}

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
              {loadingEpisodes ? (
                <p className="py-8 text-center text-xs text-slate-400">Loading episodes...</p>
              ) : filteredEpisodes.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No episodes found.</p>
              ) : (
                filteredEpisodes.map((ep, idx) => {
                  const active = ep.episodeId === decodedContentId;
                  const num = parseEpisodeNum(ep, idx);
                  return (
                    <button
                      key={ep.episodeId}
                      type="button"
                      onClick={() => goToEpisode(ep, idx)}
                      className={`flex w-full min-h-[50px] items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left ${
                        active ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-semibold text-violet-300 tabular-nums">
                          {ep.episodeNumber || `EP ${num}`}
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
        )}
      </div>

      <DownloadManagerModal
        isOpen={showDownloadManager}
        onClose={() => setShowDownloadManager(false)}
        onPlayOffline={(item) => setOfflinePlayerItem(item)}
      />

      <OfflinePlayerModal
        item={offlinePlayerItem}
        onClose={() => setOfflinePlayerItem(null)}
      />
    </div>
  );
};
