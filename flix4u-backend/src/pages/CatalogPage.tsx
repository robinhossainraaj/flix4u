import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, Languages, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { AnimeCard } from '@/src/components/AnimeCard';
import { ANIME_GENRES, searchAnime } from '@/src/services/anilistApi';
import { isHindiDubbedAnime, VERIFIED_HINDI_DUBBED_ID_LIST } from '@/src/services/hindiAnime';
import type { AnimeSummary } from '@/src/types/anime';

interface CatalogPageProps {
  presetFormat?: 'MOVIE' | 'TV';
  heading: string;
  subheading: string;
  topSlot?: React.ReactNode;
}

type LanguageFilter = 'ALL' | 'hindi' | 'original';

export const CatalogPage: React.FC<CatalogPageProps> = ({
  presetFormat,
  heading,
  subheading,
  topSlot,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get('q') || '';
  const initialGenre = searchParams.get('genre') || 'ALL';
  const initialFormat = presetFormat || searchParams.get('format') || 'ALL';
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialLang = (searchParams.get('lang') as LanguageFilter) || 'ALL';
  const initialSort =
    searchParams.get('sort') || (initialQuery ? 'SEARCH_MATCH' : 'TRENDING_DESC');
  const initialPage = Math.max(1, Number(searchParams.get('page') || 1));

  const [queryInput, setQueryInput] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [genre, setGenre] = useState(initialGenre);
  const [format, setFormat] = useState(initialFormat);
  const [status, setStatus] = useState(initialStatus);
  const [language, setLanguage] = useState<LanguageFilter>(
    initialLang === 'hindi' || initialLang === 'original' ? initialLang : 'ALL'
  );
  const [sort, setSort] = useState(initialSort);
  const [seasonYear, setSeasonYear] = useState<string>(searchParams.get('year') || 'ALL');
  const [minScore, setMinScore] = useState<string>(searchParams.get('minScore') || 'ALL');
  const [page, setPage] = useState(initialPage);

  const [items, setItems] = useState<AnimeSummary[]>([]);
  const [loadedPage, setLoadedPage] = useState(initialPage);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const langParam = searchParams.get('lang');
    setQueryInput(q);
    setDebouncedQuery(q);
    setGenre(searchParams.get('genre') || 'ALL');
    setFormat(presetFormat || searchParams.get('format') || 'ALL');
    setStatus(searchParams.get('status') || 'ALL');
    setSeasonYear(searchParams.get('year') || 'ALL');
    setMinScore(searchParams.get('minScore') || 'ALL');
    setLanguage(
      langParam === 'hindi' || langParam === 'original' ? langParam : 'ALL'
    );
    setSort(searchParams.get('sort') || (q ? 'SEARCH_MATCH' : 'TRENDING_DESC'));
    setPage(Math.max(1, Number(searchParams.get('page') || 1)));
  }, [presetFormat, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryInput);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchAnime({
          query: debouncedQuery,
          genre: genre === 'ALL' ? undefined : genre,
          format: presetFormat || format,
          status,
          sort,
          seasonYear: seasonYear !== 'ALL' ? Number(seasonYear) : undefined,
          minimumScore: minScore !== 'ALL' ? Number(minScore) : undefined,
          idIn: language === 'hindi' ? VERIFIED_HINDI_DUBBED_ID_LIST : undefined,
          page,
          perPage: 24,
          signal: controller.signal,
        });
        if (!active || controller.signal.aborted) return;
        setItems(res.items);
        setLoadedPage(page);
        setHasNextPage(res.hasNextPage);
        setTotal(res.total);
      } catch (err) {
        if (!active || controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to search catalog.');
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery, genre, format, presetFormat, status, seasonYear, minScore, language, sort, page, reloadNonce]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage) return;
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    const nextPage = loadedPage + 1;
    setLoadingMore(true);
    try {
      const res = await searchAnime({
        query: debouncedQuery,
        genre: genre === 'ALL' ? undefined : genre,
        format: presetFormat || format,
        status,
        sort,
        seasonYear: seasonYear !== 'ALL' ? Number(seasonYear) : undefined,
        minimumScore: minScore !== 'ALL' ? Number(minScore) : undefined,
        idIn: language === 'hindi' ? VERIFIED_HINDI_DUBBED_ID_LIST : undefined,
        page: nextPage,
        perPage: 24,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const entry of res.items) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            merged.push(entry);
          }
        }
        return merged;
      });
      setLoadedPage(nextPage);
      setHasNextPage(res.hasNextPage);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load more anime.');
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [
    loadingMore,
    hasNextPage,
    loadedPage,
    debouncedQuery,
    genre,
    presetFormat,
    format,
    status,
    seasonYear,
    minScore,
    sort,
    language,
  ]);

  const displayedItems = useMemo(() => {
    if (language === 'original') {
      return items.filter((item) => !isHindiDubbedAnime(item));
    }
    return items;
  }, [items, language]);

  const updateUrlParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === 'ALL') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
  };

  const resetFilters = () => {
    setQueryInput('');
    setDebouncedQuery('');
    setGenre('ALL');
    setFormat(presetFormat || 'ALL');
    setStatus('ALL');
    setSeasonYear('ALL');
    setMinScore('ALL');
    setLanguage('ALL');
    setSort('TRENDING_DESC');
    setPage(1);
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {topSlot}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {heading}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">{subheading}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="kuro-segment-track inline-flex rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                setLanguage('ALL');
                setPage(1);
                updateUrlParam({ lang: null, page: null });
              }}
              className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap ${
                language === 'ALL' ? 'kuro-segment-active' : 'kuro-segment-idle'
              }`}
            >
              All Audio
            </button>
            <button
              type="button"
              onClick={() => {
                setLanguage('hindi');
                setPage(1);
                updateUrlParam({ lang: 'hindi', page: null });
              }}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap ${
                language === 'hindi' ? 'kuro-segment-amber' : 'kuro-segment-idle'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              <span>Hindi Dubbed</span>
            </button>
          </div>

          {!loading && (
            <p className="text-xs font-medium text-slate-400 tabular-nums">
              {(language === 'original' ? displayedItems.length : total).toLocaleString()} titles
            </p>
          )}
        </div>
      </div>

      {/* Glass Advanced Filter Bar */}
      <div className="kuro-glass rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={queryInput}
              onChange={(e) => {
                setQueryInput(e.target.value);
                setPage(1);
                updateUrlParam({ q: e.target.value || null, page: null });
              }}
              placeholder="Search anime title..."
              className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d]/85 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <select
            value={genre}
            onChange={(e) => {
              setGenre(e.target.value);
              setPage(1);
              updateUrlParam({ genre: e.target.value, page: null });
            }}
            className="h-11 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="ALL">All Genres</option>
            {ANIME_GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={seasonYear}
            onChange={(e) => {
              setSeasonYear(e.target.value);
              setPage(1);
              updateUrlParam({ year: e.target.value, page: null });
            }}
            className="h-11 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="ALL">All Release Years</option>
            {Array.from({ length: 15 }).map((_, i) => {
              const yr = 2026 - i;
              return <option key={yr} value={yr}>{yr}</option>;
            })}
          </select>

          <select
            value={minScore}
            onChange={(e) => {
              setMinScore(e.target.value);
              setPage(1);
              updateUrlParam({ minScore: e.target.value, page: null });
            }}
            className="h-11 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="ALL">Any Rating</option>
            <option value="80">80%+ (Great)</option>
            <option value="70">70%+ (Good)</option>
            <option value="60">60%+ (Decent)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-white/[0.06]">
          {!presetFormat && (
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setPage(1);
                updateUrlParam({ format: e.target.value, page: null });
              }}
              className="h-11 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="ALL">All Formats (TV, Movie, etc.)</option>
              <option value="TV">TV Series</option>
              <option value="MOVIE">Movies</option>
              <option value="OVA">OVA</option>
              <option value="ONA">ONA</option>
              <option value="SPECIAL">Special</option>
            </select>
          )}

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              updateUrlParam({ status: e.target.value, page: null });
            }}
            className="h-11 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="RELEASING">Ongoing / Airing</option>
            <option value="FINISHED">Completed</option>
            <option value="NOT_YET_RELEASED">Upcoming</option>
          </select>

          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
              updateUrlParam({ sort: e.target.value, page: null });
            }}
            className="h-11 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="TRENDING_DESC">Most Popular & Trending</option>
            <option value="POPULARITY_DESC">Most Popular</option>
            <option value="SCORE_DESC">Highest Rated</option>
            <option value="START_DATE_DESC">Latest Release</option>
            <option value="TITLE_ROMAJI">A–Z Alphabetical</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="kuro-btn-glass h-11 w-full rounded-xl px-4 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(genre !== 'ALL' || seasonYear !== 'ALL' || minScore !== 'ALL' || status !== 'ALL' || format !== 'ALL' || queryInput) && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-slate-400 font-medium">Active Filters:</span>
            {genre !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs rounded-full">
                Genre: {genre}
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setGenre('ALL'); updateUrlParam({ genre: null }); }} />
              </span>
            )}
            {seasonYear !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs rounded-full">
                Year: {seasonYear}
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setSeasonYear('ALL'); updateUrlParam({ year: null }); }} />
              </span>
            )}
            {minScore !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs rounded-full">
                Score: {minScore}%+
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setMinScore('ALL'); updateUrlParam({ minScore: null }); }} />
              </span>
            )}
            {status !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs rounded-full">
                Status: {status}
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setStatus('ALL'); updateUrlParam({ status: null }); }} />
              </span>
            )}
            {format !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs rounded-full">
                Format: {format}
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setFormat('ALL'); updateUrlParam({ format: null }); }} />
              </span>
            )}
            {queryInput && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs rounded-full">
                Query: "{queryInput}"
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setQueryInput(''); setDebouncedQuery(''); updateUrlParam({ q: null }); }} />
              </span>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="kuro-glass rounded-3xl border-rose-500/30 bg-rose-500/10 p-6 sm:p-8 text-center">
          <h2 className="text-base sm:text-lg font-bold text-white">Unable to load anime catalog</h2>
          <p className="mt-2 text-xs sm:text-sm text-rose-200 break-words">{error}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="kuro-btn-primary inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-5 py-2 text-xs sm:text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="kuro-btn-glass inline-flex min-h-[42px] items-center rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <div className="aspect-[2/3] w-full animate-pulse rounded-2xl bg-[#121420]" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#121420]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#121420]" />
            </div>
          ))}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="kuro-glass flex flex-col items-center justify-center rounded-3xl py-16 text-center px-4">
          <Filter className="h-8 w-8 text-violet-400" />
          <h2 className="mt-3 text-lg font-semibold text-white">No matching anime found</h2>
          <p className="mt-1 text-sm text-slate-400">
            Try clearing one or more filters to broaden your search.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="kuro-btn-primary mt-5 min-h-[44px] rounded-2xl px-5 py-2.5 text-sm font-semibold"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="kuro-content-auto grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
            {displayedItems.map((anime, index) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                showHindiBadge
                priorityImage={index < 6}
              />
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 pt-4">
            {hasNextPage && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More Anime</span>
                )}
              </button>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  updateUrlParam({ page: String(next) });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>
              <span className="font-mono text-sm text-slate-400 tabular-nums">
                {loadedPage > page ? `Pages ${page}–${loadedPage}` : `Page ${page}`}
              </span>
              <button
                type="button"
                disabled={!hasNextPage}
                onClick={() => {
                  const next = loadedPage + 1;
                  setPage(next);
                  updateUrlParam({ page: String(next) });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
