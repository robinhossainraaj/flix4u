import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Play,
  RotateCcw,
  Server,
  Sparkles,
  TrendingUp,
  Tv,
} from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { AnimeSection } from '@/src/components/AnimeSection';
import {
  AnimeWorldEpisodeCard,
  AnimeWorldMediaCard,
} from '@/src/components/AnimeWorldCatalogView';
import { FeaturedAnimeSection } from '@/src/components/FeaturedAnimeSection';
import { HeroBanner } from '@/src/components/HeroBanner';
import { ServerSelector } from '@/src/components/ServerSelector';
import { TelegramSupportButton } from '@/src/components/TelegramSupportButton';
import { useAuth } from '@/src/context/AuthContext';
import { useServer } from '@/src/context/ServerContext';
import {
  getHomeSections,
  peekHomeSectionsCache,
  type HomeSectionsData,
} from '@/src/services/anilistApi';
import {
  buildAnimeWorldProxyImageUrl,
  fetchAnimeWorldHome,
  fetchAnimeWorldLatestEpisodes,
  fetchAnimeWorldSeries,
  peekAnimeWorldHomeSnapshot,
  type AnimeWorldFeaturedEpisode,
} from '@/src/services/animeWorldApi';
import type { AnimeWorldItem } from '@/src/types/anime';

const AnimeWorldHeroSpotlight: React.FC<{
  items: AnimeWorldItem[];
  loading: boolean;
}> = ({ items, loading }) => {
  const featured = items.slice(0, 6);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % featured.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [featured.length]);

  if (featured.length === 0) {
    if (!loading) return null;
    return (
      <section className="relative h-[400px] w-full animate-pulse rounded-3xl border border-white/[0.08] bg-[#10121c] sm:h-[480px]" />
    );
  }

  const current = featured[index % featured.length];
  const watchTarget = current.seriesId
    ? `/animeworld-india/series/${encodeURIComponent(current.seriesId)}`
    : current.movieId
      ? `/animeworld-india/watch/movie/${encodeURIComponent(current.movieId)}`
      : '/anime';

  const metaLine = [
    current.seriesId ? 'Anime Series' : 'Anime Movie',
    current.year,
    current.rating ? `★ ${current.rating}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      aria-label="Featured on AnimeWorld India"
      className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0b0d15] shadow-2xl shadow-violet-950/30"
    >
      <div className="relative h-[400px] sm:h-[480px] lg:h-[520px] w-full">
        <AnimeImage
          src={current.image}
          fallbackSrc={buildAnimeWorldProxyImageUrl(current.image, current.proxyImage)}
          alt={current.title}
          variant="banner"
          priority
          className="h-full w-full object-cover object-center transition-opacity duration-500"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080d] via-[#07080d]/60 to-[#07080d]/20" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#07080d]/95 via-[#07080d]/70 to-transparent" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" />

        <div className="absolute inset-0 flex items-end p-5 sm:p-10 lg:p-12">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-200 backdrop-blur-md tabular-nums">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>#{index + 1} Spotlight · AnimeWorld India</span>
              </span>
              {metaLine && (
                <span className="text-xs font-medium text-slate-300 tabular-nums">
                  {metaLine}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl text-balance line-clamp-2">
              {current.title}
            </h1>

            <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-300 max-w-xl">
              Stream directly from AnimeWorld India with Hindi dubbed &amp; multi-audio episode support.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <Link
                to={watchTarget}
                className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{current.seriesId ? 'View Series & Episodes' : 'Watch Movie'}</span>
              </Link>
              <Link
                to="/anime"
                className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium whitespace-nowrap shrink-0"
              >
                <Server className="h-4 w-4 text-amber-300" />
                <span>Browse All Anime</span>
              </Link>
            </div>
          </div>
        </div>

        {featured.length > 1 && (
          <div className="absolute top-4 right-4 sm:top-auto sm:bottom-6 sm:right-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev - 1 + featured.length) % featured.length)}
              aria-label="Previous featured title"
              className="kuro-btn-glass hidden sm:flex h-9 w-9 items-center justify-center rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#07080d]/65 px-2.5 py-1.5 backdrop-blur-xl">
              {featured.map((item, i) => (
                <button
                  key={`${item.seriesId || item.movieId || item.title}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show featured title ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === index ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev + 1) % featured.length)}
              aria-label="Next featured title"
              className="kuro-btn-glass hidden sm:flex h-9 w-9 items-center justify-center rounded-xl"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

interface AnimeWorldSectionGridProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AnimeWorldItem[];
  loading: boolean;
  viewAllTo: string;
  viewAllLabel?: string;
  badgeResolver?: (item: AnimeWorldItem, index: number) => string | undefined;
}

const AnimeWorldSectionGrid: React.FC<AnimeWorldSectionGridProps> = ({
  title,
  subtitle,
  icon: Icon,
  items,
  loading,
  viewAllTo,
  viewAllLabel = 'View all',
  badgeResolver,
}) => {
  return (
    <section className="kuro-content-auto space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 shrink-0 text-amber-300" />
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-400">{subtitle}</p>
        </div>

        <Link
          to={viewAllTo}
          className="kuro-btn-glass inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200 whitespace-nowrap shrink-0"
        >
          <span>{viewAllLabel}</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#10121c]"
            >
              <div className="aspect-[2/3] w-full animate-pulse bg-white/[0.05]" />
              <div className="space-y-2 p-2.5 sm:p-3">
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="kuro-glass rounded-2xl p-8 text-center text-sm text-slate-400">
          No content returned in this section right now.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item, idx) => (
            <AnimeWorldMediaCard
              key={`${item.seriesId || item.movieId || item.title}-${idx}`}
              item={item}
              badgeText={badgeResolver ? badgeResolver(item, idx) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
};

function getAnimeWorldItemKey(item: AnimeWorldItem): string {
  if (item.seriesId) return `series:${item.seriesId}`;
  if (item.movieId) return `movie:${item.movieId}`;
  return `title:${item.title.toLowerCase().trim()}`;
}

function rankPopularAnimeWorldItems(
  latestSeries: AnimeWorldItem[],
  latestMovies: AnimeWorldItem[],
  seriesCatalog: AnimeWorldItem[]
): AnimeWorldItem[] {
  const homeIndexMap = new Map<string, number>();
  [...latestSeries, ...latestMovies].forEach((item, idx) => {
    const key = getAnimeWorldItemKey(item);
    if (!homeIndexMap.has(key)) homeIndexMap.set(key, idx);
  });

  const uniqueMap = new Map<string, AnimeWorldItem>();
  for (const item of [...latestSeries, ...seriesCatalog, ...latestMovies]) {
    const key = getAnimeWorldItemKey(item);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  const scoreItem = (item: AnimeWorldItem): number => {
    const key = getAnimeWorldItemKey(item);
    const parsedRating = item.rating ? Number.parseFloat(item.rating) : 0;
    const ratingScore = Number.isFinite(parsedRating) ? parsedRating * 10 : 0;

    const homePos = homeIndexMap.get(key);
    const trendingBoost = homePos !== undefined ? Math.max(8, 36 - homePos * 2) : 0;

    const parsedYear = item.year ? Number.parseInt(item.year, 10) : 0;
    const recencyBoost =
      Number.isFinite(parsedYear) && parsedYear >= 2020
        ? Math.min(12, (parsedYear - 2019) * 2)
        : 0;

    const seriesBoost = item.seriesId ? 4 : 0;
    return ratingScore + trendingBoost + recencyBoost + seriesBoost;
  };

  return Array.from(uniqueMap.values()).sort((a, b) => scoreItem(b) - scoreItem(a));
}

export const HomePage: React.FC = () => {
  const { history } = useAuth();
  const { isAnimeWorld } = useServer();

  const [initialAwSnapshot] = useState(() => peekAnimeWorldHomeSnapshot());
  const [initialGlobalSnapshot] = useState(() => peekHomeSectionsCache());

  // AnimeWorld India (Default) state
  const [awLoading, setAwLoading] = useState(() => !initialAwSnapshot.home);
  const [awError, setAwError] = useState<string | null>(null);
  const [awLatestSeries, setAwLatestSeries] = useState<AnimeWorldItem[]>(
    () => initialAwSnapshot.home?.latest_series || []
  );
  const [awSeriesCatalog, setAwSeriesCatalog] = useState<AnimeWorldItem[]>(
    () => initialAwSnapshot.seriesPage1?.series || []
  );
  const [awLatestMovies, setAwLatestMovies] = useState<AnimeWorldItem[]>(
    () => initialAwSnapshot.home?.latest_movies || []
  );
  const [awEpisodes, setAwEpisodes] = useState<AnimeWorldFeaturedEpisode[]>([]);
  const [awEpisodesLoading, setAwEpisodesLoading] = useState(false);

  // Flix4U Global (Manual selection only) state
  const [globalSections, setGlobalSections] = useState<HomeSectionsData | null>(
    () => initialGlobalSnapshot
  );
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadAnimeWorldContent = useCallback(async (isStillActive?: () => boolean) => {
    const snap = peekAnimeWorldHomeSnapshot();
    if (!snap.home) {
      setAwLoading(true);
    }
    setAwError(null);
    try {
      const seriesPage2Promise = fetchAnimeWorldSeries(2).catch(() => null);
      const [homeSettled, seriesPage1Settled] = await Promise.allSettled([
        fetchAnimeWorldHome(),
        fetchAnimeWorldSeries(1),
      ]);
      if (isStillActive && !isStillActive()) return;

      const homeRes = homeSettled.status === 'fulfilled' ? homeSettled.value : null;
      const seriesPage1Res = seriesPage1Settled.status === 'fulfilled' ? seriesPage1Settled.value : null;
      if (!homeRes && !seriesPage1Res) {
        throw homeSettled.status === 'rejected'
          ? homeSettled.reason
          : new Error('Unable to load AnimeWorld India catalog.');
      }

      const latestSeries = homeRes?.latest_series || [];
      const latestMovies = homeRes?.latest_movies || [];

      const page1Catalog: AnimeWorldItem[] = [];
      const seenSeries = new Set<string>();
      for (const s of seriesPage1Res?.series || []) {
        const key = getAnimeWorldItemKey(s);
        if (!seenSeries.has(key)) {
          seenSeries.add(key);
          page1Catalog.push(s);
        }
      }

      setAwLatestSeries(latestSeries);
      setAwLatestMovies(latestMovies);
      setAwSeriesCatalog(page1Catalog);
      setAwLoading(false);

      // Merge page 2 asynchronously without delaying initial Home paint
      seriesPage2Promise.then((seriesPage2Res) => {
        if (isStillActive && !isStillActive()) return;
        const page2List = seriesPage2Res?.series || [];
        if (page2List.length === 0) return;
        setAwSeriesCatalog((prev) => {
          const seen = new Set(prev.map(getAnimeWorldItemKey));
          const merged = [...prev];
          for (const item of page2List) {
            const key = getAnimeWorldItemKey(item);
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(item);
            }
          }
          return merged;
        });
      });

      const ranked = rankPopularAnimeWorldItems(latestSeries, latestMovies, page1Catalog);
      const episodeSourceSeries = ranked.filter((x) => Boolean(x.seriesId)).slice(0, 3);
      const fallbackSourceSeries =
        episodeSourceSeries.length > 0
          ? episodeSourceSeries
          : latestSeries.length > 0
            ? latestSeries
            : page1Catalog;

      if (fallbackSourceSeries.length > 0) {
        setAwEpisodesLoading(true);
        fetchAnimeWorldLatestEpisodes(fallbackSourceSeries, 3, 8)
          .then((eps) => {
            if (!isStillActive || isStillActive()) {
              setAwEpisodes(eps);
            }
          })
          .catch(() => {
            if (!isStillActive || isStillActive()) {
              setAwEpisodes([]);
            }
          })
          .finally(() => {
            if (!isStillActive || isStillActive()) {
              setAwEpisodesLoading(false);
            }
          });
      } else {
        setAwEpisodes([]);
      }
    } catch (err) {
      if (isStillActive && !isStillActive()) return;
      setAwError(
        err instanceof Error ? err.message : 'Unable to load AnimeWorld India catalog.'
      );
      setAwLoading(false);
    }
  }, []);

  const loadGlobalContent = useCallback(async (isStillActive?: () => boolean) => {
    setGlobalLoading(true);
    setGlobalError(null);
    try {
      const data = await getHomeSections();
      if (isStillActive && !isStillActive()) return;
      setGlobalSections(data);
    } catch (err) {
      if (isStillActive && !isStillActive()) return;
      setGlobalError(
        err instanceof Error ? err.message : 'Unable to load Flix4U Global catalog.'
      );
    } finally {
      if (!isStillActive || isStillActive()) {
        setGlobalLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const checkActive = () => active;

    if (isAnimeWorld) {
      loadAnimeWorldContent(checkActive);
    } else {
      loadGlobalContent(checkActive);
    }

    return () => {
      active = false;
    };
  }, [isAnimeWorld, loadAnimeWorldContent, loadGlobalContent]);

  const awRankedPopular = useMemo(
    () => rankPopularAnimeWorldItems(awLatestSeries, awLatestMovies, awSeriesCatalog),
    [awLatestSeries, awLatestMovies, awSeriesCatalog]
  );

  const awPopularItems = useMemo(() => awRankedPopular.slice(0, 12), [awRankedPopular]);

  const awPopularKeys = useMemo(
    () => new Set(awPopularItems.map(getAnimeWorldItemKey)),
    [awPopularItems]
  );

  const awRemainingSeries = useMemo(() => {
    const merged: AnimeWorldItem[] = [];
    const seen = new Set<string>();
    for (const item of [...awLatestSeries, ...awSeriesCatalog]) {
      const key = getAnimeWorldItemKey(item);
      if (seen.has(key) || awPopularKeys.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged.length > 0 ? merged : awSeriesCatalog;
  }, [awLatestSeries, awSeriesCatalog, awPopularKeys]);

  const awRemainingMovies = useMemo(() => {
    const filtered = awLatestMovies.filter(
      (item) => !awPopularKeys.has(getAnimeWorldItemKey(item))
    );
    return filtered.length > 0 ? filtered : awLatestMovies;
  }, [awLatestMovies, awPopularKeys]);

  const awSpotlightItems =
    awPopularItems.length > 0
      ? awPopularItems.slice(0, 6)
      : awLatestSeries.length > 0
        ? [...awLatestSeries.slice(0, 4), ...awLatestMovies.slice(0, 2)]
        : awLatestMovies;

  return (
    <div className="mx-auto max-w-7xl space-y-10 sm:space-y-12 px-4 py-5 sm:px-6 sm:py-8">
      {isAnimeWorld ? (
        <>
          {awError ? (
            <div className="kuro-glass rounded-3xl border-rose-500/30 bg-rose-500/10 p-8 text-center">
              <h2 className="text-lg font-bold text-white">Failed to load AnimeWorld India</h2>
              <p className="mt-2 text-sm text-rose-200">{awError}</p>
              <button
                type="button"
                onClick={() => loadAnimeWorldContent()}
                className="kuro-btn-primary mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <AnimeWorldHeroSpotlight items={awSpotlightItems} loading={awLoading} />
          )}

          {!awError && (
            <AnimeWorldSectionGrid
              title="Popular Anime"
              subtitle="Most popular and trending anime on AnimeWorld India right now"
              icon={TrendingUp}
              items={awPopularItems}
              loading={awLoading}
              viewAllTo="/anime?tab=series"
              badgeResolver={(_, idx) => (idx < 6 ? `#${idx + 1} Trending` : 'Popular')}
            />
          )}

          {/* Existing Server Selector */}
          <ServerSelector variant="cards" showQuickLinks />

          {history.length > 0 && (
            <ContinueWatchingSection history={history} />
          )}

          {!awError && (
            <>
              {(awEpisodesLoading || awEpisodes.length > 0) && (
                <section className="kuro-content-auto space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Play className="h-5 w-5 shrink-0 text-amber-300" />
                        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                          Latest Episodes
                        </h2>
                      </div>
                      <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                        Stream available AnimeWorld India episodes immediately
                      </p>
                    </div>
                    <Link
                      to="/anime?tab=series"
                      className="kuro-btn-glass inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200 whitespace-nowrap shrink-0"
                    >
                      <span>All Series</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {awEpisodesLoading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#10121c]"
                        >
                          <div className="aspect-video w-full animate-pulse bg-white/[0.05]" />
                          <div className="space-y-2 p-2.5 sm:p-3">
                            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.08]" />
                            <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.05]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {awEpisodes.map((entry) => (
                        <AnimeWorldEpisodeCard
                          key={`${entry.seriesId}-${entry.seasonId}-${entry.episode.episodeId}`}
                          entry={entry}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {awRemainingSeries.length > 0 && (
                <AnimeWorldSectionGrid
                  title="All Remaining Anime"
                  subtitle="More Hindi dubbed & multi-audio anime series on AnimeWorld India"
                  icon={Tv}
                  items={awRemainingSeries}
                  loading={awLoading}
                  viewAllTo="/anime?tab=series"
                  viewAllLabel="Browse Series"
                />
              )}

              <AnimeWorldSectionGrid
                title="Anime Movies"
                subtitle="Feature films streaming directly on AnimeWorld India"
                icon={Film}
                items={awRemainingMovies}
                loading={awLoading}
                viewAllTo="/anime?tab=movies"
                viewAllLabel="All Movies"
              />
            </>
          )}
        </>
      ) : (
        <>
          {globalError ? (
            <div className="kuro-glass rounded-3xl border-rose-500/30 bg-rose-500/10 p-8 text-center">
              <h2 className="text-lg font-bold text-white">Failed to load Flix4U Global</h2>
              <p className="mt-2 text-sm text-rose-200">{globalError}</p>
              <button
                type="button"
                onClick={() => loadGlobalContent()}
                className="kuro-btn-primary mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <>
              <HeroBanner items={globalSections?.trending || []} loading={globalLoading} />
              <FeaturedAnimeSection
                items={globalSections?.featuredPriority || []}
                loading={globalLoading}
              />
            </>
          )}

          {/* Existing Server Selector */}
          <ServerSelector variant="cards" showQuickLinks />

          {history.length > 0 && (
            <ContinueWatchingSection history={history} />
          )}

          {!globalError && (
            <div className="space-y-10 sm:space-y-12">
              <div className="kuro-content-auto">
                <AnimeSection
                  title="Trending Now"
                  subtitle="Most watched anime across the global community"
                  items={globalSections?.trending || []}
                  loading={globalLoading}
                  viewAllTo="/anime?sort=TRENDING_DESC"
                  badgeResolver={(_, idx) => `Trending #${idx + 1}`}
                />
              </div>

              <div className="kuro-content-auto">
                <AnimeSection
                  title="Popular Anime"
                  subtitle="All-time fan favorites and acclaimed series"
                  items={globalSections?.popular || []}
                  loading={globalLoading}
                  viewAllTo="/anime?sort=POPULARITY_DESC"
                />
              </div>

              <div className="kuro-content-auto">
                <AnimeSection
                  title="New Episodes"
                  subtitle="Currently airing shows with new episodes this week"
                  items={globalSections?.latestEpisodes || []}
                  loading={globalLoading}
                  viewAllTo="/anime?status=RELEASING&sort=UPDATED_AT_DESC"
                  badgeResolver={(anime) =>
                    anime.nextAiringEpisode?.episode
                      ? `New Episode · Ep ${Math.max(1, anime.nextAiringEpisode.episode - 1)}`
                      : 'New Episode'
                  }
                />
              </div>

              <div className="kuro-content-auto">
                <AnimeSection
                  title="Recently Updated"
                  subtitle="Freshly cataloged and updated anime releases"
                  items={globalSections?.recentlyUpdated || []}
                  loading={globalLoading}
                  viewAllTo="/anime?sort=UPDATED_AT_DESC"
                />
              </div>

              <div className="kuro-content-auto">
                <AnimeSection
                  title="Upcoming Anime"
                  subtitle="Anticipated premieres announced for upcoming seasons"
                  items={globalSections?.upcoming || []}
                  loading={globalLoading}
                  viewAllTo="/anime?status=NOT_YET_RELEASED&sort=POPULARITY_DESC"
                  badgeResolver={(anime) =>
                    anime.seasonYear ? `${anime.season || 'TBA'} ${anime.seasonYear}` : 'Upcoming'
                  }
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ContinueWatchingSection: React.FC<{
  history: ReturnType<typeof useAuth>['history'];
}> = ({ history }) => (
  <section className="space-y-4">
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Continue Watching
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
          Resume right where you left off
        </p>
      </div>
      <Link
        to="/profile"
        className="kuro-btn-glass inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200 whitespace-nowrap shrink-0"
      >
        <span>View history</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>

    <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
      {history.slice(0, 4).map((item) => {
        const pct =
          item.durationSeconds > 0
            ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
            : 0;
        return (
          <Link
            key={`${item.animeId}-${item.episodeId}`}
            to={`/watch/${item.animeId}/${encodeURIComponent(item.episodeId)}?ep=${item.episodeNumber}`}
            className="kuro-glass group flex w-[275px] sm:w-auto shrink-0 snap-start items-center gap-3.5 rounded-2xl p-3 hover:border-violet-500/50 hover:shadow-[0_10px_28px_-10px_rgba(124,58,237,0.35)] active:scale-[0.98] transition-all duration-200"
          >
            <div className="relative h-21 w-14 shrink-0 overflow-hidden rounded-xl bg-[#161925]">
              <AnimeImage
                src={item.coverImage}
                alt={item.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-4 w-4 fill-white text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-slate-400 tabular-nums">
                Ep {item.episodeNumber} · {item.audioMode.toUpperCase()}
              </p>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.1]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  style={{ width: `${Math.max(8, pct)}%` }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  </section>
);
