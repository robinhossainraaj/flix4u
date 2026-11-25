import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Film,
  Flame,
  ListFilter,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Server,
  Tv,
} from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { ServerSelector } from '@/src/components/ServerSelector';
import {
  buildAnimeWorldProxyImageUrl,
  fetchAnimeWorldA2Z,
  fetchAnimeWorldHome,
  fetchAnimeWorldLatestEpisodes,
  fetchAnimeWorldMovies,
  fetchAnimeWorldSeries,
  searchAnimeWorld,
  type AnimeWorldFeaturedEpisode,
} from '@/src/services/animeWorldApi';
import type { AnimeWorldItem } from '@/src/types/anime';

export type AnimeWorldCatalogTab = 'home' | 'series' | 'movies' | 'a2z' | 'search';

const ALPHABET_LETTERS = [
  '0-9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

export function buildAnimeWorldItemRoute(item: AnimeWorldItem): string {
  if (item.seriesId) {
    return `/animeworld-india/series/${encodeURIComponent(item.seriesId)}`;
  }
  if (item.movieId) {
    return `/animeworld-india/watch/movie/${encodeURIComponent(item.movieId)}`;
  }
  return '/anime';
}

export const AnimeWorldMediaCard: React.FC<{
  item: AnimeWorldItem;
  badgeText?: string;
}> = React.memo(({ item, badgeText }) => {
  const to = buildAnimeWorldItemRoute(item);
  const metaParts = [
    item.year,
    item.rating ? `★ ${item.rating}` : null,
    item.seriesId ? 'Series' : 'Movie',
  ].filter(Boolean);

  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10121c] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-violet-400/50 hover:shadow-[0_14px_34px_-12px_rgba(139,92,246,0.45)] active:scale-[0.98]"
    >
      <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-[#151726]">
        <AnimeImage
          src={item.image}
          fallbackSrc={buildAnimeWorldProxyImageUrl(item.image, item.proxyImage)}
          alt={item.title}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent opacity-80 transition-opacity group-hover:opacity-95" />
        {badgeText && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-lg border border-amber-300/35 bg-black/80 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-300 tabular-nums">
            {badgeText}
          </span>
        )}
        <div className="pointer-events-none absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/25 bg-black/70 text-white opacity-90 transition-transform duration-200 group-hover:scale-105 group-hover:bg-violet-600/90">
          <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 translate-x-0.5 fill-current" />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1.5 p-2.5 sm:p-3">
        <h3
          className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-white group-hover:text-violet-300 transition-colors"
          title={item.title}
        >
          {item.title}
        </h3>
        {metaParts.length > 0 && (
          <p className="truncate text-[11px] sm:text-xs text-slate-400 tabular-nums">
            {metaParts.join(' · ')}
          </p>
        )}
      </div>
    </Link>
  );
});

export const AnimeWorldEpisodeCard: React.FC<{ entry: AnimeWorldFeaturedEpisode }> = React.memo(({
  entry,
}) => {
  const watchUrl = `/animeworld-india/watch/episode/${encodeURIComponent(
    entry.episode.episodeId
  )}?seriesId=${encodeURIComponent(entry.seriesId)}&seasonId=${encodeURIComponent(
    entry.seasonId
  )}&ep=${encodeURIComponent(String(entry.epNum))}`;

  return (
    <Link
      to={watchUrl}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10121c] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-amber-400/50 hover:shadow-[0_12px_28px_-12px_rgba(245,158,11,0.35)] active:scale-[0.98]"
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[#151726]">
        <AnimeImage
          src={entry.episode.image || entry.seriesPoster}
          fallbackSrc={buildAnimeWorldProxyImageUrl(
            entry.episode.image || entry.seriesPoster,
            entry.episode.proxyImage
          )}
          alt={`${entry.seriesTitle} ${entry.episode.episodeNumber || `Episode ${entry.epNum}`}`}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <span className="absolute left-2 top-2 rounded-lg border border-amber-400/35 bg-black/80 px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-amber-300 tabular-nums">
          {entry.episode.episodeNumber || `EP ${entry.epNum}`}
        </span>
        <div className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/25 bg-black/75 text-white transition-transform duration-200 group-hover:scale-105 group-hover:bg-violet-600/90">
          <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 translate-x-0.5 fill-current" />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1 p-2.5 sm:p-3">
        <p className="truncate text-[11px] sm:text-xs font-semibold text-amber-300/95">
          {entry.seriesTitle}
        </p>
        <h3 className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-white group-hover:text-violet-200 transition-colors">
          {entry.episode.title || `Episode ${entry.epNum}`}
        </h3>
      </div>
    </Link>
  );
});

const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#10121c]"
      >
        <div className="aspect-[2/3] w-full animate-pulse bg-white/[0.05]" />
        <div className="space-y-2 p-3">
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-white/[0.08]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
        </div>
      </div>
    ))}
  </div>
);

interface PaginationState {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  pages: number[];
}

const PaginationControls: React.FC<{
  pagination: PaginationState;
  onPageChange: (page: number) => void;
}> = ({ pagination, onPageChange }) => {
  const { currentPage, totalPages, hasNext, hasPrev, pages } = pagination;
  if (totalPages <= 1 && !hasNext && !hasPrev) return null;

  const pageList =
    pages.length > 0
      ? pages.slice(0, 7)
      : Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1);

  return (
    <nav
      aria-label="Catalog pagination"
      className="flex flex-wrap items-center justify-center gap-2 pt-4"
    >
      <button
        type="button"
        disabled={!hasPrev || currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Prev</span>
      </button>

      {pageList.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onPageChange(num)}
          className={`min-h-[44px] min-w-[44px] rounded-2xl px-3 py-2 text-xs font-semibold tabular-nums ${
            num === currentPage ? 'kuro-btn-primary' : 'kuro-btn-glass text-slate-300'
          }`}
        >
          {num}
        </button>
      ))}

      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPageChange(currentPage + 1)}
        className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
      >
        <span>Next</span>
        <ChevronRight className="h-4 w-4" />
      </button>

      <span className="ml-2 text-xs text-slate-400 tabular-nums">
        Page {currentPage} of {Math.max(currentPage, totalPages)}
      </span>
    </nav>
  );
};

interface AnimeWorldCatalogViewProps {
  defaultTab?: AnimeWorldCatalogTab;
  showServerSelector?: boolean;
  showBackHomeLink?: boolean;
}

export const AnimeWorldCatalogView: React.FC<AnimeWorldCatalogViewProps> = ({
  defaultTab = 'home',
  showServerSelector = false,
  showBackHomeLink = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = (searchParams.get('tab') || defaultTab).toLowerCase();
  const activeTab: AnimeWorldCatalogTab =
    rawTab === 'series' ||
    rawTab === 'movies' ||
    rawTab === 'a2z' ||
    rawTab === 'search' ||
    rawTab === 'home'
      ? rawTab
      : defaultTab;
  const currentPage = Math.max(1, Number(searchParams.get('p') || 1) || 1);
  const activeLetter = (searchParams.get('letter') || 'A').toUpperCase();
  const activeQuery = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(activeQuery);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [latestSeries, setLatestSeries] = useState<AnimeWorldItem[]>([]);
  const [latestMovies, setLatestMovies] = useState<AnimeWorldItem[]>([]);
  const [featuredEpisodes, setFeaturedEpisodes] = useState<AnimeWorldFeaturedEpisode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [listItems, setListItems] = useState<AnimeWorldItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
    pages: [],
  });

  useEffect(() => {
    setSearchInput(activeQuery);
  }, [activeQuery]);

  const updateRouteParams = useCallback(
    (updates: { tab?: AnimeWorldCatalogTab; p?: number; letter?: string; q?: string }) => {
      const nextTab = updates.tab ?? activeTab;
      const params = new URLSearchParams();
      params.set('tab', nextTab);
      if (nextTab === 'a2z') {
        params.set('letter', updates.letter ?? activeLetter);
      }
      if (nextTab === 'search') {
        const qVal = updates.q !== undefined ? updates.q : activeQuery;
        if (qVal.trim()) params.set('q', qVal.trim());
      }
      if (nextTab !== 'home') {
        const nextPage = updates.p ?? 1;
        if (nextPage > 1) params.set('p', String(nextPage));
      }
      setSearchParams(params);
    },
    [activeTab, activeLetter, activeQuery, setSearchParams]
  );

  const loadTabContent = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'home') {
        const res = await fetchAnimeWorldHome();
        if (controller.signal.aborted) return;
        const seriesList = res.latest_series || [];
        setLatestSeries(seriesList);
        setLatestMovies(res.latest_movies || []);
        setListItems([]);
        setLoading(false);

        if (seriesList.length > 0) {
          setLoadingEpisodes(true);
          fetchAnimeWorldLatestEpisodes(seriesList, 3, 8)
            .then((eps) => {
              if (!controller.signal.aborted) setFeaturedEpisodes(eps);
            })
            .catch(() => {
              if (!controller.signal.aborted) setFeaturedEpisodes([]);
            })
            .finally(() => {
              if (!controller.signal.aborted) setLoadingEpisodes(false);
            });
        } else {
          setFeaturedEpisodes([]);
        }
        return;
      }

      if (activeTab === 'series') {
        const res = await fetchAnimeWorldSeries(currentPage);
        if (controller.signal.aborted) return;
        setListItems(res.series || []);
        setPagination({
          currentPage: res.current_page || currentPage,
          totalPages: res.total_pages || currentPage,
          hasNext: Boolean(res.has_next),
          hasPrev: Boolean(res.has_prev),
          pages: res.pages || [],
        });
      } else if (activeTab === 'movies') {
        const res = await fetchAnimeWorldMovies(currentPage);
        if (controller.signal.aborted) return;
        setListItems(res.movies || []);
        setPagination({
          currentPage: res.current_page || currentPage,
          totalPages: res.total_pages || currentPage,
          hasNext: Boolean(res.has_next),
          hasPrev: Boolean(res.has_prev),
          pages: res.pages || [],
        });
      } else if (activeTab === 'a2z') {
        const safeLetter = ALPHABET_LETTERS.includes(activeLetter) ? activeLetter : 'A';
        const res = await fetchAnimeWorldA2Z(safeLetter, currentPage);
        if (controller.signal.aborted) return;
        setListItems(res.results || []);
        setPagination({
          currentPage: res.current_page || currentPage,
          totalPages: res.total_pages || currentPage,
          hasNext: Boolean(res.has_next),
          hasPrev: Boolean(res.has_prev),
          pages: res.pages || [],
        });
      } else if (activeTab === 'search') {
        const trimmed = activeQuery.trim();
        if (!trimmed) {
          setListItems([]);
          setPagination({
            currentPage: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
            pages: [],
          });
          setLoading(false);
          return;
        }
        const res = await searchAnimeWorld(trimmed, currentPage, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setListItems(res.results || []);
        setPagination({
          currentPage: res.current_page || res.currentPage || currentPage,
          totalPages: res.total_pages || currentPage,
          hasNext: Boolean(res.has_next),
          hasPrev: Boolean(res.has_prev),
          pages: res.pages || [],
        });
      }
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Unable to reach AnimeWorld India server.'
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [activeTab, currentPage, activeLetter, activeQuery]);

  const handleLoadMoreAw = useCallback(async () => {
    if (loadingMore || !pagination.hasNext) return;
    const nextPage = pagination.currentPage + 1;
    setLoadingMore(true);
    try {
      let nextItems: AnimeWorldItem[] = [];
      let nextHas = false;
      let nextTotal = pagination.totalPages;
      let nextPages = pagination.pages;
      if (activeTab === 'series') {
        const res = await fetchAnimeWorldSeries(nextPage);
        nextItems = res.series || [];
        nextHas = Boolean(res.has_next);
        nextTotal = res.total_pages || nextPage;
        nextPages = res.pages || pagination.pages;
      } else if (activeTab === 'movies') {
        const res = await fetchAnimeWorldMovies(nextPage);
        nextItems = res.movies || [];
        nextHas = Boolean(res.has_next);
        nextTotal = res.total_pages || nextPage;
        nextPages = res.pages || pagination.pages;
      } else if (activeTab === 'a2z') {
        const safeLetter = ALPHABET_LETTERS.includes(activeLetter) ? activeLetter : 'A';
        const res = await fetchAnimeWorldA2Z(safeLetter, nextPage);
        nextItems = res.results || [];
        nextHas = Boolean(res.has_next);
        nextTotal = res.total_pages || nextPage;
        nextPages = res.pages || pagination.pages;
      } else if (activeTab === 'search' && activeQuery.trim()) {
        const res = await searchAnimeWorld(activeQuery.trim(), nextPage);
        nextItems = res.results || [];
        nextHas = Boolean(res.has_next);
        nextTotal = res.total_pages || nextPage;
        nextPages = res.pages || pagination.pages;
      }

      setListItems((prev) => {
        const seen = new Set(prev.map((x) => x.seriesId || x.movieId || x.title));
        const merged = [...prev];
        for (const item of nextItems) {
          const k = item.seriesId || item.movieId || item.title;
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(item);
          }
        }
        return merged;
      });
      setPagination({
        currentPage: nextPage,
        totalPages: nextTotal,
        hasNext: nextHas,
        hasPrev: pagination.hasPrev,
        pages: nextPages,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load more items from AnimeWorld India.'
      );
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, pagination, activeTab, activeLetter, activeQuery]);

  useEffect(() => {
    loadTabContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadTabContent]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    updateRouteParams({ tab: 'search', q: trimmed, p: 1 });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      {showServerSelector && <ServerSelector variant="compact" />}

      {/* Server Header Banner */}
      <section className="kuro-glass-elevated relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-8 h-56 w-56 rounded-full bg-amber-500/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {showBackHomeLink && (
                <Link
                  to="/"
                  className="kuro-btn-glass inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>All Servers</span>
                </Link>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Server className="h-3.5 w-3.5" />
                <span>Primary Server · Default Content</span>
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-white">
              AnimeWorld{' '}
              <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-violet-400 bg-clip-text text-transparent">
                India
              </span>
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-300">
              Browse AnimeWorld India&apos;s Hindi dubbed &amp; multi-audio anime, series, episodes,
              movies, and A–Z catalog.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="w-full lg:w-96 shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search on AnimeWorld India..."
                  aria-label="Search on AnimeWorld India"
                  className="h-11 w-full rounded-2xl border border-white/[0.12] bg-[#07080d]/85 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <button
                type="submit"
                className="kuro-btn-primary min-h-[44px] shrink-0 rounded-2xl px-4 text-xs sm:text-sm font-semibold"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Section Tabs */}
        <div className="relative z-10 mt-5 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={() => updateRouteParams({ tab: 'home', p: 1 })}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold ${
              activeTab === 'home' ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
            }`}
          >
            <Flame className="h-4 w-4 text-amber-300" />
            <span>Latest</span>
          </button>

          <button
            type="button"
            onClick={() => updateRouteParams({ tab: 'series', p: 1 })}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold ${
              activeTab === 'series' ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
            }`}
          >
            <Tv className="h-4 w-4 text-violet-300" />
            <span>Series</span>
          </button>

          <button
            type="button"
            onClick={() => updateRouteParams({ tab: 'movies', p: 1 })}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold ${
              activeTab === 'movies' ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
            }`}
          >
            <Film className="h-4 w-4 text-fuchsia-300" />
            <span>Movies</span>
          </button>

          <button
            type="button"
            onClick={() => updateRouteParams({ tab: 'a2z', p: 1 })}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold ${
              activeTab === 'a2z' ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
            }`}
          >
            <ListFilter className="h-4 w-4 text-sky-300" />
            <span>A–Z Index</span>
          </button>

          <button
            type="button"
            onClick={() => updateRouteParams({ tab: 'search', p: 1 })}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold ${
              activeTab === 'search' ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
            }`}
          >
            <Search className="h-4 w-4 text-emerald-300" />
            <span>Search</span>
          </button>
        </div>
      </section>

      {/* A-Z Letter Bar */}
      {activeTab === 'a2z' && (
        <div className="kuro-glass rounded-3xl p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Browse Alphabetically
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALPHABET_LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => updateRouteParams({ tab: 'a2z', letter, p: 1 })}
                className={`min-h-[40px] min-w-[40px] rounded-xl px-2.5 text-xs font-bold ${
                  activeLetter === letter ? 'kuro-btn-primary' : 'kuro-btn-glass text-slate-300'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      {error ? (
        <div className="kuro-glass rounded-3xl border-rose-500/30 bg-rose-500/10 p-8 text-center">
          <h2 className="text-lg font-bold text-white">AnimeWorld India Server Error</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-rose-200">{error}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={loadTabContent}
              className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : loading ? (
        <CardGridSkeleton count={12} />
      ) : activeTab === 'home' ? (
        <div className="space-y-10">
          {/* Latest Series */}
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Latest Anime Series</h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                  Freshly updated Hindi &amp; multi-audio episodic releases
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateRouteParams({ tab: 'series', p: 1 })}
                className="kuro-btn-glass inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200"
              >
                <span>All Series</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {latestSeries.length === 0 ? (
              <div className="kuro-glass rounded-2xl p-8 text-center text-sm text-slate-400">
                No latest series returned by AnimeWorld India.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {latestSeries.map((item) => (
                  <AnimeWorldMediaCard key={`series-${item.seriesId || item.title}`} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* Latest Episodes */}
          {(loadingEpisodes || featuredEpisodes.length > 0) && (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Latest Episodes</h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                    Stream newly released AnimeWorld India episodes directly
                  </p>
                </div>
              </div>

              {loadingEpisodes ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
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
                  {featuredEpisodes.map((entry) => (
                    <AnimeWorldEpisodeCard
                      key={`${entry.seriesId}-${entry.seasonId}-${entry.episode.episodeId}`}
                      entry={entry}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Latest Movies */}
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Latest Anime Movies</h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                  Feature films available directly on AnimeWorld India
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateRouteParams({ tab: 'movies', p: 1 })}
                className="kuro-btn-glass inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200"
              >
                <span>All Movies</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {latestMovies.length === 0 ? (
              <div className="kuro-glass rounded-2xl p-8 text-center text-sm text-slate-400">
                No latest movies returned by AnimeWorld India.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {latestMovies.map((item) => (
                  <AnimeWorldMediaCard key={`movie-${item.movieId || item.title}`} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : activeTab === 'search' && !activeQuery.trim() ? (
        <div className="kuro-glass rounded-3xl p-10 text-center space-y-3">
          <Search className="mx-auto h-9 w-9 text-violet-400" />
          <h2 className="text-lg font-bold text-white">Search AnimeWorld India</h2>
          <p className="text-sm text-slate-400">
            Enter an anime series or movie title above to query AnimeWorld India directly.
          </p>
        </div>
      ) : listItems.length === 0 ? (
        <div className="kuro-glass rounded-3xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-white">No matching titles found</p>
          <p className="text-sm text-slate-400">
            {activeTab === 'search'
              ? `No AnimeWorld India results matched "${activeQuery}".`
              : 'This page returned no entries.'}
          </p>
        </div>
      ) : (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {activeTab === 'series'
                ? 'All Series'
                : activeTab === 'movies'
                  ? 'All Movies'
                  : activeTab === 'a2z'
                    ? `Alphabetical: ${activeLetter}`
                    : `Search Results for "${activeQuery}"`}
            </h2>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {listItems.length} items · Page {pagination.currentPage}
            </span>
          </div>

          <div className="kuro-content-auto grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {listItems.map((item) => (
              <AnimeWorldMediaCard
                key={`${item.seriesId || item.movieId || item.title}`}
                item={item}
              />
            ))}
          </div>

          {pagination.hasNext && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMoreAw}
                className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More Titles</span>
                )}
              </button>
            </div>
          )}

          <PaginationControls
            pagination={pagination}
            onPageChange={(nextPage) => updateRouteParams({ p: nextPage })}
          />
        </section>
      )}
    </div>
  );
};
