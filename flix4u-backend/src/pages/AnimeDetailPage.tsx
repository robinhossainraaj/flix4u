import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bookmark,
  Check,
  CheckCircle2,
  Download,
  Film,
  Heart,
  Layers,
  Loader2,
  Play,
  Search,
  X,
} from 'lucide-react';
import { AnimeCard } from '@/src/components/AnimeCard';
import { AnimeImage } from '@/src/components/AnimeImage';
import { DownloadManagerModal } from '@/src/components/DownloadManagerModal';
import { OfflinePlayerModal } from '@/src/components/OfflinePlayerModal';
import { useAuth } from '@/src/context/AuthContext';
import { getAnimeDetails, getDisplayTitle, stripHtml } from '@/src/services/anilistApi';
import {
  getStoredDownloads,
  resolveBestDownloadableStreamForEpisode,
  startDownloadEpisode,
  type DownloadItem,
} from '@/src/services/downloadService';
import { isHindiDubbedAnime } from '@/src/services/hindiAnime';
import { fetchAnimeEpisodes } from '@/src/services/streamingApi';
import type { AnimeDetail, EpisodeItem } from '@/src/types/anime';

const CHUNK_SIZE = 50;

export const AnimeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const animeId = Number(id);

  const {
    preferences,
    isInWatchlist,
    isFavorite,
    toggleWatchlist,
    toggleFavorite,
    getHistoryForAnime,
  } = useAuth();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [aniZipMalId, setAniZipMalId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [epFilter, setEpFilter] = useState('');
  const [chunkIndex, setChunkIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [downloadsMap, setDownloadsMap] = useState<Record<string, DownloadItem>>({});
  const [resolvingEpId, setResolvingEpId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showDownloadManager, setShowDownloadManager] = useState(false);
  const [offlinePlayerItem, setOfflinePlayerItem] = useState<DownloadItem | null>(null);

  useEffect(() => {
    const sync = () => {
      const next: Record<string, DownloadItem> = {};
      for (const item of getStoredDownloads()) {
        next[item.id] = item;
      }
      setDownloadsMap(next);
    };
    sync();
    window.addEventListener('flix4u:downloads-updated', sync);
    return () => window.removeEventListener('flix4u:downloads-updated', sync);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(animeId) || animeId <= 0) {
      setError('Invalid anime ID.');
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setChunkIndex(0);
      setEpFilter('');
      try {
        const detail = await getAnimeDetails(animeId);
        if (!active) return;
        setAnime(detail);
        const epRes = await fetchAnimeEpisodes(animeId, detail);
        if (!active) return;
        setEpisodes(epRes.episodes);
        setAniZipMalId(epRes.aniZipMalId ?? null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load anime details.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    window.scrollTo({ top: 0 });
    return () => {
      active = false;
    };
  }, [animeId, reloadNonce]);

  const chunks = useMemo(() => {
    if (episodes.length <= CHUNK_SIZE) return [];
    const list: Array<{ label: string; start: number; end: number }> = [];
    for (let i = 0; i < episodes.length; i += CHUNK_SIZE) {
      const startEp = episodes[i]?.number ?? i + 1;
      const endEp = episodes[Math.min(episodes.length - 1, i + CHUNK_SIZE - 1)]?.number ?? i + CHUNK_SIZE;
      list.push({
        label: `${startEp}–${endEp}`,
        start: i,
        end: i + CHUNK_SIZE,
      });
    }
    return list;
  }, [episodes]);

  const filteredEpisodes = useMemo(() => {
    const q = epFilter.trim().toLowerCase();
    if (q) {
      return episodes.filter(
        (ep) => String(ep.number).includes(q) || ep.title.toLowerCase().includes(q)
      );
    }
    if (chunks.length > 0 && chunks[chunkIndex]) {
      const { start, end } = chunks[chunkIndex];
      return episodes.slice(start, end);
    }
    return episodes;
  }, [episodes, epFilter, chunks, chunkIndex]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <div className="h-64 sm:h-80 w-full animate-pulse rounded-3xl bg-[#121420]" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#121420]" />
          <div className="space-y-4 md:col-span-3">
            <div className="h-8 w-2/3 animate-pulse rounded bg-[#121420]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[#121420]" />
            <div className="h-32 w-full animate-pulse rounded bg-[#121420]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Anime Not Found</h1>
        <p className="mt-2 break-words text-sm text-rose-300">{error || 'Unable to load details.'}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="kuro-btn-primary inline-flex min-h-[44px] items-center rounded-2xl px-5 py-2.5 text-sm font-semibold"
          >
            Retry
          </button>
          <Link
            to="/"
            className="kuro-btn-glass inline-flex min-h-[44px] items-center rounded-2xl px-5 py-2.5 text-sm font-semibold"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const displayTitle = getDisplayTitle(anime.title);
  const inWatchlist = isInWatchlist(anime.id);
  const favored = isFavorite(anime.id);
  const historyEntry = getHistoryForAnime(anime.id);
  const isHindiVerified = isHindiDubbedAnime(anime);
  const studio =
    anime.studios?.nodes?.find((s) => s.isAnimationStudio)?.name ||
    anime.studios?.nodes?.[0]?.name ||
    'Unknown Studio';
  const score = anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)} / 10` : 'Unrated';
  const firstEpisode = episodes[0];
  const primaryEpisodeForDownload =
    (historyEntry
      ? episodes.find((e) => e.number === historyEntry.episodeNumber)
      : undefined) || firstEpisode;

  const handleEpisodeDownload = async (ep: EpisodeItem) => {
    const audioMode = preferences.preferredAudio || 'sub';
    const effectiveEpId = audioMode === 'dub' && ep.dubId ? ep.dubId : ep.id;
    const downloadId = `${anime.id}-${effectiveEpId}`;
    const existing = downloadsMap[downloadId] || downloadsMap[`${anime.id}-${ep.id}`];

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

    setDownloadError(null);
    setResolvingEpId(ep.id);
    try {
      const resolved = await resolveBestDownloadableStreamForEpisode({
        episodeId: ep.id,
        dubId: ep.dubId,
        episodeNumber: ep.number,
        anilistId: anime.id,
        malId: anime.idMal || aniZipMalId,
        audioMode,
        animeTitle: anime.title.english || anime.title.romaji || displayTitle,
        romajiTitle: anime.title.romaji || undefined,
        format: anime.format,
        seasonYear: anime.seasonYear,
      });

      if (!resolved.ok) {
        setDownloadError(resolved.message);
        return;
      }

      await startDownloadEpisode({
        id: downloadId,
        animeId: anime.id,
        animeTitle: displayTitle,
        coverImage: anime.coverImage?.large || anime.coverImage?.extraLarge || '',
        episodeId: effectiveEpId,
        episodeNumber: ep.number,
        episodeTitle: ep.title,
        audioMode,
        streamUrl: resolved.candidate.url,
        format: resolved.candidate.format,
        quality: resolved.candidate.quality,
        referer: resolved.candidate.referer,
        serverName: resolved.serverName,
        refreshContext: resolved.refreshContext,
        fileSize: 0,
      });
      setShowDownloadManager(true);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Unable to prepare episode download.'
      );
    } finally {
      setResolvingEpId((curr) => (curr === ep.id ? null : curr));
    }
  };

  const watchTarget = historyEntry
    ? `/watch/${anime.id}/${encodeURIComponent(historyEntry.episodeId)}?ep=${historyEntry.episodeNumber}`
    : firstEpisode
      ? `/watch/${anime.id}/${encodeURIComponent(firstEpisode.id)}?ep=${firstEpisode.number}`
      : `/watch/${anime.id}/${encodeURIComponent(`anime-${anime.id}-episode-1`)}?ep=1`;

  const franchiseEntries = (anime.relations?.edges || []).filter(
    (edge) =>
      edge.node &&
      ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'TV_SHORT'].includes(edge.node.format || '') &&
      ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF'].includes(
        edge.relationType
      )
  );

  const related = (anime.relations?.edges || [])
    .filter((edge) => edge.node && edge.node.format !== 'MUSIC')
    .slice(0, 6);

  return (
    <div className="pb-16">
      {/* Cover Banner */}
      <div className="relative h-64 w-full overflow-hidden border-b border-white/[0.08] sm:h-80 lg:h-96">
        <AnimeImage
          src={anime.bannerImage || anime.coverImage?.extraLarge}
          alt={displayTitle}
          variant="banner"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080d] via-[#07080d]/70 to-[#07080d]/25" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mt-28 relative z-10 grid grid-cols-1 gap-7 md:grid-cols-[240px_1fr]">
          {/* Poster */}
          <div className="mx-auto w-44 sm:w-52 md:w-full">
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/15 bg-[#10121c] shadow-2xl shadow-black/70">
              <AnimeImage
                src={anime.coverImage?.extraLarge || anime.coverImage?.large}
                alt={displayTitle}
                variant="poster"
                priority
                className="h-full w-full object-cover"
              />
              {isHindiVerified && (
                <span className="absolute top-3 left-3 rounded-lg border border-amber-300/35 bg-amber-500/95 px-2.5 py-1 text-[11px] font-bold text-[#07080d] shadow-md">
                  Hindi Dubbed
                </span>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-5 pt-1 md:pt-12">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
                {displayTitle}
              </h1>
              <div className="mt-2 space-y-0.5 text-xs sm:text-sm text-slate-400">
                {anime.title.romaji && anime.title.romaji !== displayTitle && (
                  <p>Romaji: {anime.title.romaji}</p>
                )}
                {anime.title.native && <p>Japanese: {anime.title.native}</p>}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <Link
                to={watchTarget}
                className="kuro-btn-primary inline-flex min-h-[46px] items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>
                  {historyEntry ? `Resume Episode ${historyEntry.episodeNumber}` : 'Watch Now'}
                </span>
              </Link>

              <button
                type="button"
                onClick={() => toggleWatchlist(anime)}
                className={`inline-flex min-h-[46px] items-center gap-2 rounded-2xl px-4.5 py-3 text-sm font-semibold whitespace-nowrap shrink-0 ${
                  inWatchlist ? 'kuro-btn-active' : 'kuro-btn-glass'
                }`}
              >
                {inWatchlist ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(anime)}
                className={`inline-flex min-h-[46px] items-center gap-2 rounded-2xl px-4.5 py-3 text-sm font-semibold whitespace-nowrap shrink-0 transition-[transform,filter,box-shadow] duration-150 active:scale-[0.97] ${
                  favored
                    ? 'border border-rose-400/50 bg-gradient-to-b from-rose-500/35 to-rose-700/25 text-rose-100 shadow-[inset_0_1px_0_rgba(255,228,230,0.22),0_4px_14px_-3px_rgba(225,29,72,0.38)]'
                    : 'kuro-btn-glass'
                }`}
              >
                <Heart className={`h-4 w-4 ${favored ? 'fill-current text-rose-400' : ''}`} />
                <span>{favored ? 'Favorited' : 'Favorite'}</span>
              </button>

              {primaryEpisodeForDownload && (() => {
                const audioMode = preferences.preferredAudio || 'sub';
                const effId =
                  audioMode === 'dub' && primaryEpisodeForDownload.dubId
                    ? primaryEpisodeForDownload.dubId
                    : primaryEpisodeForDownload.id;
                const primaryDl =
                  downloadsMap[`${anime.id}-${effId}`] ||
                  downloadsMap[`${anime.id}-${primaryEpisodeForDownload.id}`];
                const isPrimaryCompleted = primaryDl?.status === 'completed';
                const isPrimaryDownloading = primaryDl?.status === 'downloading';
                const isPrimaryUnsupported = primaryDl?.status === 'unsupported';
                return (
                  <button
                    type="button"
                    onClick={() => void handleEpisodeDownload(primaryEpisodeForDownload)}
                    disabled={resolvingEpId === primaryEpisodeForDownload.id}
                    className={`inline-flex min-h-[46px] items-center gap-2 rounded-2xl px-4.5 py-3 text-sm font-semibold whitespace-nowrap shrink-0 disabled:opacity-60 ${
                      isPrimaryCompleted
                        ? 'kuro-btn-active text-emerald-200'
                        : isPrimaryUnsupported
                          ? 'kuro-btn-glass border-amber-400/35 text-amber-200'
                          : 'kuro-btn-glass text-violet-200'
                    }`}
                  >
                    {resolvingEpId === primaryEpisodeForDownload.id || isPrimaryDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPrimaryCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : isPrimaryUnsupported ? (
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>
                      {isPrimaryCompleted
                        ? `Play EP ${primaryEpisodeForDownload.number} Offline`
                        : isPrimaryDownloading && primaryDl
                          ? `Downloading (${primaryDl.progress}%)`
                          : isPrimaryUnsupported
                            ? 'Download Not Supported'
                            : `Download EP ${primaryEpisodeForDownload.number}`}
                    </span>
                  </button>
                );
              })()}

              {anime.trailer?.site === 'youtube' && anime.trailer.id && (
                <button
                  type="button"
                  onClick={() => setShowTrailer(true)}
                  className="kuro-btn-glass inline-flex min-h-[46px] items-center gap-2 rounded-2xl px-4.5 py-3 text-sm font-semibold whitespace-nowrap shrink-0"
                >
                  <Film className="h-4 w-4" />
                  <span>Trailer</span>
                </button>
              )}
            </div>

            {downloadError && (
              <div className="kuro-glass flex items-center justify-between gap-3 rounded-2xl border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                <span>{downloadError}</span>
                <button
                  type="button"
                  onClick={() => setDownloadError(null)}
                  aria-label="Dismiss error"
                  className="kuro-btn-glass flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Frosted Glass Metadata Grid */}
            <dl className="kuro-glass grid grid-cols-2 gap-4 rounded-2xl p-4 sm:grid-cols-5">
              <div>
                <dt className="text-xs text-slate-400">Release Year</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white tabular-nums">
                  {anime.seasonYear || 'TBA'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Status</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white">
                  {anime.status ? anime.status.replace(/_/g, ' ') : 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Episodes</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white tabular-nums">
                  {anime.episodes || episodes.length || 'Ongoing'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Rating</dt>
                <dd className="mt-0.5 text-sm font-semibold text-amber-400 tabular-nums">
                  ★ {score}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Studio</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white truncate">{studio}</dd>
              </div>
            </dl>

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-xs font-medium text-slate-500">Genres:</span>
                {anime.genres.map((g) => (
                  <Link
                    key={g}
                    to={`/anime?genre=${encodeURIComponent(g)}`}
                    className="text-sm font-medium text-violet-300 hover:text-violet-200 underline-offset-4 hover:underline"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <div className="space-y-1.5">
              <h2 className="text-sm font-semibold text-slate-300">Synopsis</h2>
              <p className="max-w-4xl whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {stripHtml(anime.description)}
              </p>
            </div>
          </div>
        </div>

        {/* Seasons & Related Franchise Selector */}
        {franchiseEntries.length > 0 && (
          <section className="mt-10 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="h-4 w-4 text-violet-400" />
              <h2>Seasons &amp; Franchise Entries</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              <div className="flex w-[210px] shrink-0 items-center gap-3 rounded-2xl border border-violet-500/70 bg-violet-600/20 p-2.5 shadow-lg shadow-violet-950/30">
                <AnimeImage
                  src={anime.coverImage?.medium || anime.coverImage?.large}
                  alt={displayTitle}
                  className="h-14 w-10 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                    Current
                  </span>
                  <p className="truncate text-xs font-semibold text-white">{displayTitle}</p>
                </div>
              </div>

              {franchiseEntries.slice(0, 8).map((edge) => {
                const entryTitle = getDisplayTitle(edge.node.title);
                return (
                  <Link
                    key={`${edge.relationType}-${edge.node.id}`}
                    to={`/anime/${edge.node.id}`}
                    className="kuro-glass flex w-[210px] shrink-0 items-center gap-3 rounded-2xl p-2.5 hover:border-violet-500/50 transition-colors"
                  >
                    <AnimeImage
                      src={edge.node.coverImage?.medium || edge.node.coverImage?.large}
                      alt={entryTitle}
                      className="h-14 w-10 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {edge.relationType.replace(/_/g, ' ')}
                      </span>
                      <p className="truncate text-xs font-semibold text-slate-100">{entryTitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Episodes Section */}
        <section className="mt-12 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Episodes</h2>
              <p className="text-xs sm:text-sm text-slate-400 tabular-nums">
                {episodes.length > 0
                  ? `${episodes.length} episodes indexed`
                  : 'No released episodes listed yet'}
              </p>
            </div>

            {episodes.length > 8 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={epFilter}
                  onChange={(e) => setEpFilter(e.target.value)}
                  placeholder="Jump to episode..."
                  aria-label="Filter episodes"
                  className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#10121c] pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {chunks.length > 0 && !epFilter.trim() && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {chunks.map((chunk, idx) => (
                <button
                  key={chunk.label}
                  type="button"
                  onClick={() => setChunkIndex(idx)}
                  className={`min-h-[38px] shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold tabular-nums ${
                    chunkIndex === idx ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                  }`}
                >
                  Eps {chunk.label}
                </button>
              ))}
            </div>
          )}

          {filteredEpisodes.length === 0 ? (
            <div className="kuro-glass rounded-2xl p-8 text-center text-sm text-slate-400">
              {episodes.length === 0
                ? 'Episodes will appear once the series begins airing.'
                : 'No episodes match that filter.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredEpisodes.map((ep) => {
                const isLastWatched = historyEntry?.episodeNumber === ep.number;
                const audioMode = preferences.preferredAudio || 'sub';
                const effectiveEpId = audioMode === 'dub' && ep.dubId ? ep.dubId : ep.id;
                const dlItem =
                  downloadsMap[`${anime.id}-${effectiveEpId}`] ||
                  downloadsMap[`${anime.id}-${ep.id}`];
                const isResolving = resolvingEpId === ep.id;
                const isCompleted = dlItem?.status === 'completed';
                const isDownloading = dlItem?.status === 'downloading';
                const isUnsupported = dlItem?.status === 'unsupported';

                return (
                  <div
                    key={ep.id}
                    className={`flex min-h-[64px] items-center justify-between gap-2 rounded-2xl border p-2.5 pl-3.5 transition-all ${
                      isLastWatched
                        ? 'border-violet-500 bg-violet-600/20 shadow-lg shadow-violet-950/30'
                        : 'border-white/[0.08] bg-[#10121c]/85 hover:border-violet-500/50 hover:bg-[#161927]'
                    }`}
                  >
                    <Link
                      to={`/watch/${anime.id}/${encodeURIComponent(effectiveEpId)}?ep=${ep.number}`}
                      className="group flex min-w-0 flex-1 items-center gap-2.5 py-0.5 active:scale-[0.98]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-violet-300 tabular-nums">
                          <span>Episode {ep.number}</span>
                          {isCompleted && (
                            <span className="text-[10px] font-bold text-emerald-400">· OFFLINE</span>
                          )}
                          {isDownloading && dlItem && (
                            <span className="text-[10px] text-amber-300">· {dlItem.progress}%</span>
                          )}
                          {isUnsupported && (
                            <span className="text-[10px] text-amber-300">· NOT SUPPORTED</span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium text-slate-100">
                          {ep.title}
                        </p>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => void handleEpisodeDownload(ep)}
                      disabled={isResolving}
                      aria-label={
                        isCompleted
                          ? `Play Episode ${ep.number} offline`
                          : isDownloading
                            ? `Episode ${ep.number} downloading`
                            : isUnsupported
                              ? `Episode ${ep.number} Download Not Supported`
                              : `Download Episode ${ep.number}`
                      }
                      title={
                        isCompleted
                          ? 'Saved offline — Tap to play offline'
                          : isDownloading
                            ? `Downloading (${dlItem?.progress || 0}%)`
                            : isUnsupported
                              ? 'Download Not Supported'
                              : 'Download episode for offline viewing'
                      }
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                        isCompleted
                          ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                          : isDownloading
                            ? 'border-violet-400/35 bg-violet-500/15 text-violet-300'
                            : isUnsupported
                              ? 'border-amber-400/35 bg-amber-500/10 text-amber-300'
                              : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-violet-400/45 hover:text-white'
                      }`}
                    >
                      {isResolving || isDownloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isUnsupported ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Related Anime */}
        {related.length > 0 && (
          <section className="mt-14 space-y-4">
            <h2 className="text-xl font-bold text-white">Related Anime</h2>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
              {related.map((edge) => (
                <AnimeCard
                  key={`${edge.relationType}-${edge.node.id}`}
                  anime={edge.node}
                  badgeText={edge.relationType.replace(/_/g, ' ')}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Official Trailer Modal */}
      {showTrailer && anime.trailer?.id && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Official Trailer"
        >
          <div className="kuro-glass-elevated relative w-full max-w-4xl overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <span className="text-sm font-semibold text-white">{displayTitle} — Official Trailer</span>
              <button
                type="button"
                onClick={() => setShowTrailer(false)}
                aria-label="Close trailer"
                className="kuro-btn-glass flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${anime.trailer.id}?autoplay=1`}
                title={`${displayTitle} Trailer`}
                allowFullScreen
                allow="autoplay; encrypted-media"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}
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
