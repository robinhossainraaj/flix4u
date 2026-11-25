import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Server,
  Star,
} from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import {
  buildAnimeWorldProxyImageUrl,
  fetchAnimeWorldEpisodes,
  fetchAnimeWorldSeasons,
  type AnimeWorldSeasonsResponse,
} from '@/src/services/animeWorldApi';
import type { AnimeWorldEpisode, AnimeWorldSeason } from '@/src/types/anime';

function parseEpisodeNumText(ep: AnimeWorldEpisode, fallbackIdx: number): number {
  const m =
    ep.episodeNumber?.match(/(\d+)/) ||
    ep.episodeId?.match(/\d+x(\d+)/i) ||
    ep.episodeId?.match(/episode[-_]?(\d+)/i);
  return m ? Number(m[1]) : fallbackIdx + 1;
}

export const AnimeWorldSeriesPage: React.FC = () => {
  const { seriesId } = useParams<{ seriesId: string }>();
  const decodedSeriesId = seriesId ? decodeURIComponent(seriesId) : '';

  const [seriesData, setSeriesData] = useState<AnimeWorldSeasonsResponse | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [episodes, setEpisodes] = useState<AnimeWorldEpisode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [epFilter, setEpFilter] = useState('');

  const loadSeries = useCallback(async () => {
    if (!decodedSeriesId) return;
    setLoadingSeries(true);
    setSeriesError(null);
    try {
      const res = await fetchAnimeWorldSeasons(decodedSeriesId);
      if (res.status >= 400 || !res.data?.success) {
        throw new Error(
          res.data?.error || `Failed to load series details (HTTP ${res.status || 502}).`
        );
      }
      setSeriesData(res.data);
      const firstSeason = res.data.seasons?.[0]?.seasonId || '';
      setSelectedSeasonId(firstSeason);
    } catch (err) {
      setSeriesError(
        err instanceof Error ? err.message : 'Unable to load AnimeWorld India series.'
      );
    } finally {
      setLoadingSeries(false);
    }
  }, [decodedSeriesId]);

  useEffect(() => {
    loadSeries();
    window.scrollTo({ top: 0 });
  }, [loadSeries]);

  const loadSeasonEpisodes = useCallback(async (seasonId: string) => {
    if (!seasonId) return;
    setLoadingEpisodes(true);
    setEpisodesError(null);
    try {
      const res = await fetchAnimeWorldEpisodes(seasonId);
      if (res.status >= 400 || !res.data?.success) {
        throw new Error(
          res.data?.error || `Failed to load episodes (HTTP ${res.status || 502}).`
        );
      }
      setEpisodes(res.data.episodes || []);
    } catch (err) {
      setEpisodes([]);
      setEpisodesError(
        err instanceof Error ? err.message : 'Unable to fetch episodes for this season.'
      );
    } finally {
      setLoadingEpisodes(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadSeasonEpisodes(selectedSeasonId);
    }
  }, [selectedSeasonId, loadSeasonEpisodes]);

  const activeSeason: AnimeWorldSeason | undefined = useMemo(
    () => seriesData?.seasons.find((s) => s.seasonId === selectedSeasonId) || seriesData?.seasons[0],
    [seriesData, selectedSeasonId]
  );

  const filteredEpisodes = useMemo(() => {
    const q = epFilter.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        ep.episodeNumber.toLowerCase().includes(q) ||
        ep.episodeId.toLowerCase().includes(q)
    );
  }, [episodes, epFilter]);

  if (loadingSeries) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="h-72 w-full animate-pulse rounded-3xl bg-white/[0.04]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  if (seriesError || !seriesData) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="kuro-glass rounded-3xl border-rose-500/30 bg-rose-500/10 p-8 text-center">
          <h1 className="text-xl font-bold text-white">Series Unavailable</h1>
          <p className="mt-2 text-sm text-rose-200">
            {seriesError || 'AnimeWorld India series details could not be loaded.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={loadSeries}
              className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry</span>
            </button>
            <Link
              to="/animeworld-india"
              className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to AnimeWorld India</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { series, seasons } = seriesData;
  const firstEpisode = episodes[0];
  const firstWatchUrl =
    firstEpisode && activeSeason
      ? `/animeworld-india/watch/episode/${encodeURIComponent(firstEpisode.episodeId)}?seriesId=${encodeURIComponent(
          series.seriesId
        )}&seasonId=${encodeURIComponent(activeSeason.seasonId)}&ep=${encodeURIComponent(
          String(parseEpisodeNumText(firstEpisode, 0))
        )}`
      : null;

  return (
    <div className="pb-12">
      {/* Backdrop Header */}
      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="absolute inset-0">
          <AnimeImage
            src={series.banner || series.poster}
            fallbackSrc={buildAnimeWorldProxyImageUrl(
              series.banner || series.poster,
              series.banner ? series.proxyBanner : series.proxyPoster
            )}
            alt={series.title}
            variant="banner"
            priority
            className="h-full w-full object-cover opacity-30 blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#07080d]/70 via-[#07080d]/85 to-[var(--theme-bg,#07080d)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/animeworld-india"
              className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>AnimeWorld India</span>
            </Link>

            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <Server className="h-3.5 w-3.5" />
              <span>AnimeWorld India Server</span>
            </span>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-end">
            <div className="mx-auto w-44 sm:w-52 shrink-0 overflow-hidden rounded-3xl border border-white/[0.14] bg-[#10121c] shadow-2xl md:mx-0">
              <AnimeImage
                src={series.poster}
                fallbackSrc={buildAnimeWorldProxyImageUrl(series.poster, series.proxyPoster)}
                alt={series.title}
                priority
                className="aspect-[2/3] w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
              <div className="space-y-2">
                <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-white">
                  {series.title}
                </h1>

                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-300 md:justify-start tabular-nums">
                  {series.year && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-violet-300" />
                      {series.year}
                    </span>
                  )}
                  {series.rating && (
                    <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                      <Star className="h-3.5 w-3.5 fill-amber-300" />
                      {series.rating}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-violet-300" />
                    {series.totalSeasons} {Number(series.totalSeasons) === 1 ? 'Season' : 'Seasons'}
                  </span>
                  {series.totalEpisodes && Number(series.totalEpisodes) > 0 && (
                    <span>· {series.totalEpisodes} Episodes</span>
                  )}
                </div>
              </div>

              {series.description && (
                <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-300">
                  {series.description}
                </p>
              )}

              {(series.languages?.length > 0 || (series.genres && series.genres.length > 0)) && (
                <div className="space-y-1 text-xs text-slate-400">
                  {series.languages?.length > 0 && (
                    <p>
                      <span className="font-semibold text-slate-200">Audio:</span>{' '}
                      {series.languages.join(' · ')}
                    </p>
                  )}
                  {series.genres && series.genres.length > 0 && (
                    <p>
                      <span className="font-semibold text-slate-200">Genres:</span>{' '}
                      {series.genres.join(' · ')}
                    </p>
                  )}
                </div>
              )}

              {firstWatchUrl && (
                <div className="pt-1">
                  <Link
                    to={firstWatchUrl}
                    className="kuro-btn-primary inline-flex min-h-[46px] items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Watch {activeSeason?.seasonName || 'Season'} · Ep 1</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Seasons & Episodes */}
      <div className="mx-auto mt-8 max-w-7xl space-y-6 px-4 sm:px-6">
        {/* Season Selector */}
        {seasons.length > 0 && (
          <section className="kuro-glass rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">Seasons</h2>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {seasons.length} available
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => {
                const isSelected = activeSeason?.seasonId === season.seasonId;
                return (
                  <button
                    key={season.seasonId}
                    type="button"
                    onClick={() => setSelectedSeasonId(season.seasonId)}
                    className={`min-h-[44px] rounded-2xl px-4 py-2 text-left text-xs sm:text-sm font-semibold transition-all ${
                      isSelected ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                    }`}
                  >
                    <span>{season.seasonName}</span>
                    {season.episodes && (
                      <span className="ml-2 font-mono text-[11px] opacity-75 tabular-nums">
                        {season.episodes}
                      </span>
                    )}
                    {season.isSubOnly && (
                      <span className="ml-2 text-[10px] font-medium text-amber-300">
                        · SUB
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Episodes Grid */}
        <section className="kuro-glass rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-xl font-bold text-white">
                {activeSeason ? `${activeSeason.seasonName} Episodes` : 'Episodes'}
              </h2>
              <p className="text-xs text-slate-400 tabular-nums">
                {loadingEpisodes
                  ? 'Fetching episodes...'
                  : `${episodes.length} episodes in this season`}
              </p>
            </div>

            {episodes.length > 10 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={epFilter}
                  onChange={(e) => setEpFilter(e.target.value)}
                  placeholder="Filter episode..."
                  aria-label="Filter season episodes"
                  className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d]/85 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {loadingEpisodes ? (
            <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
              <span>Loading episodes...</span>
            </div>
          ) : episodesError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
              <p className="text-sm text-rose-200">{episodesError}</p>
              <button
                type="button"
                onClick={() => activeSeason && loadSeasonEpisodes(activeSeason.seasonId)}
                className="kuro-btn-primary inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry Episodes</span>
              </button>
            </div>
          ) : filteredEpisodes.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No episodes found for this season.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEpisodes.map((ep, idx) => {
                const epNum = parseEpisodeNumText(ep, idx);
                const watchTo = `/animeworld-india/watch/episode/${encodeURIComponent(
                  ep.episodeId
                )}?seriesId=${encodeURIComponent(series.seriesId)}&seasonId=${encodeURIComponent(
                  activeSeason?.seasonId || ''
                )}&ep=${encodeURIComponent(String(epNum))}`;

                return (
                  <Link
                    key={ep.episodeId}
                    to={watchTo}
                    className="kuro-btn-glass group flex items-center gap-3.5 rounded-2xl p-2.5 hover:border-violet-400/50 transition-all"
                  >
                    <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-[#151726]">
                      <AnimeImage
                        src={ep.image || series.poster}
                        fallbackSrc={buildAnimeWorldProxyImageUrl(
                          ep.image || series.poster,
                          ep.proxyImage || series.proxyPoster
                        )}
                        alt={ep.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-85 group-hover:bg-black/25 transition-colors">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white border border-white/25 group-hover:bg-violet-600 transition-colors">
                          <Play className="h-3.5 w-3.5 translate-x-0.5 fill-current" />
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-mono text-xs font-semibold text-violet-300 tabular-nums">
                        {ep.episodeNumber || `Episode ${epNum}`}
                      </p>
                      <h3 className="line-clamp-2 text-xs sm:text-sm font-semibold text-white group-hover:text-violet-200 transition-colors">
                        {ep.title}
                      </h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
