import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  Check,
  Loader2,
  RotateCcw,
  Search,
  User,
  X,
} from 'lucide-react';
import { ASSETS } from '@/src/config/env';
import {
  ANIME_SERIES_FILTERS,
  fetchCharacterGalleryPage,
  type CharacterCategoryFilter,
} from '@/src/services/charactersApi';
import type { AnimeCharacterAvatar } from '@/src/types/anime';

interface AvatarGalleryModalProps {
  isOpen: boolean;
  currentAvatarUrl?: string;
  displayName: string;
  onClose: () => void;
  onSave: (photoURL: string) => Promise<void>;
}

const CATEGORY_TABS: Array<{ id: CharacterCategoryFilter; label: string }> = [
  { id: 'ALL', label: 'All Characters' },
  { id: 'MAIN', label: 'Main Cast' },
  { id: 'SUPPORTING', label: 'Supporting' },
];

export const AvatarGalleryModal: React.FC<AvatarGalleryModalProps> = ({
  isOpen,
  currentAvatarUrl,
  displayName,
  onClose,
  onSave,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [seriesId, setSeriesId] = useState<string>('all');
  const [category, setCategory] = useState<CharacterCategoryFilter>('ALL');

  const [characters, setCharacters] = useState<AnimeCharacterAvatar[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAvatar, setSelectedAvatar] = useState<{
    url: string;
    name: string;
    series: string;
    role?: string | null;
  }>({
    url: currentAvatarUrl || ASSETS.defaultAvatar,
    name: 'Current Avatar',
    series: displayName,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Sync preview selection whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const startUrl = currentAvatarUrl || ASSETS.defaultAvatar;
      setSelectedAvatar({
        url: startUrl,
        name: startUrl === ASSETS.defaultAvatar ? 'Default Avatar' : 'Current Profile Picture',
        series: displayName,
      });
      setSaveError(null);
    }
  }, [isOpen, currentAvatarUrl, displayName]);

  // Debounce search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, saving, onClose]);

  const loadCharacters = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetchCharacterGalleryPage({
          search: debouncedSearch,
          seriesId,
          category,
          page: targetPage,
          perPage: 24,
        });

        setCharacters((prev) => {
          if (!append) return res.characters;
          const seen = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          for (const item of res.characters) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          return merged;
        });
        setPage(res.currentPage);
        setHasNextPage(res.hasNextPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load anime characters right now.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, seriesId, category]
  );

  // Fetch initial page when modal opens or filters change
  useEffect(() => {
    if (!isOpen) return;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    loadCharacters(1, false);
  }, [isOpen, loadCharacters]);

  // Infinite scroll observer
  useEffect(() => {
    if (!isOpen || !hasNextPage || loading || loadingMore) return;
    const sentinel = loadMoreSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadCharacters(page + 1, true);
        }
      },
      { root, rootMargin: '220px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isOpen, hasNextPage, loading, loadingMore, page, loadCharacters]);

  const handleUseDefault = () => {
    setSelectedAvatar({
      url: ASSETS.defaultAvatar,
      name: 'Default Flix4U Avatar',
      series: 'Standard Profile Picture',
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selectedAvatar.url || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(selectedAvatar.url);
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save profile picture. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const activeSeriesLabel =
    ANIME_SERIES_FILTERS.find((s) => s.id === seriesId)?.label || 'All Anime';

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="avatar-gallery-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !saving) onClose();
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-gallery-title"
          >
            <motion.div
              key="avatar-gallery-sheet"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-[92vh] max-h-[860px] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/[0.14] bg-[#0d0f18]/90 shadow-[0_32px_100px_-16px_rgba(124,58,237,0.4)] backdrop-blur-3xl"
            >
              {/* Subtle iOS 26 top specular glass sheen */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-500/[0.12] via-white/[0.03] to-transparent"
              />

              {/* Header */}
              <div className="relative flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2
                    id="avatar-gallery-title"
                    className="text-lg font-bold tracking-tight text-white sm:text-xl text-balance"
                  >
                    Anime Character Avatar Gallery
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Choose an anime character portrait for your profile or switch back to the default avatar
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  aria-label="Close avatar gallery"
                  className="kuro-btn-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search & Filter Controls */}
              <div className="relative space-y-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-3.5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search character (e.g. Gojo, Naruto, Luffy, Jinwoo)..."
                      aria-label="Search anime characters by name"
                      className="h-10 w-full rounded-2xl border border-white/[0.1] bg-[#08090d]/80 pl-10 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/70 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => setSearchInput('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Role / Category Segmented Control */}
                  <div
                    role="tablist"
                    aria-label="Character category"
                    className="kuro-segment-track inline-flex shrink-0 items-center gap-1 rounded-2xl p-1"
                  >
                    {CATEGORY_TABS.map((tabItem) => {
                      const active = category === tabItem.id;
                      return (
                        <button
                          key={tabItem.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setCategory(tabItem.id)}
                          className={`whitespace-nowrap shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            active ? 'kuro-segment-active' : 'kuro-segment-idle'
                          }`}
                        >
                          {tabItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Anime Series Filter Row */}
                <div
                  className="flex items-center gap-2 overflow-x-auto pb-1"
                  aria-label="Filter characters by anime series"
                >
                  {ANIME_SERIES_FILTERS.map((series) => {
                    const active = seriesId === series.id;
                    return (
                      <button
                        key={series.id}
                        type="button"
                        onClick={() => setSeriesId(series.id)}
                        className={`whitespace-nowrap shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          active ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                        }`}
                      >
                        {series.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body: Responsive Grid + Live Preview Sidebar */}
              <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
                {/* Preview & Save Panel */}
                <aside className="flex flex-col justify-between gap-4 border-b border-white/[0.08] bg-white/[0.025] p-4 sm:p-5 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
                  <div className="flex items-center gap-4 lg:flex-col lg:items-center lg:text-center">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-white/[0.16] bg-[#141726] shadow-lg shadow-violet-950/30 lg:h-36 lg:w-36">
                      <CharacterPortraitImg
                        src={selectedAvatar.url}
                        alt={selectedAvatar.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1 lg:w-full">
                      <p className="text-xs font-medium text-violet-300">Live Preview</p>
                      <h3 className="mt-0.5 truncate text-base font-bold text-white">
                        {selectedAvatar.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {[selectedAvatar.series, selectedAvatar.role].filter(Boolean).join(' · ')}
                      </p>

                      {/* Mini header chip preview */}
                      <div className="mt-3 hidden items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#08090d]/70 px-3 py-2 lg:inline-flex">
                        <CharacterPortraitImg
                          src={selectedAvatar.url}
                          alt={displayName}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                        <span className="max-w-[140px] truncate text-xs font-medium text-slate-200">
                          {displayName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                    {saveError && (
                      <p className="w-full text-xs text-rose-300">{saveError}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="kuro-btn-primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Save Profile Picture</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleUseDefault}
                      disabled={saving}
                      className="kuro-btn-glass inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Default Picture</span>
                    </button>
                  </div>
                </aside>

                {/* Scrollable Character Grid */}
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-6"
                >
                  <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {activeSeriesLabel}
                      {debouncedSearch ? ` · "${debouncedSearch}"` : ''}
                    </span>
                    <span className="tabular-nums">
                      {loading ? 'Loading...' : `${characters.length} characters`}
                    </span>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div
                          key={i}
                          className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2"
                        >
                          <div className="aspect-square w-full animate-pulse rounded-xl bg-white/[0.06]" />
                          <div className="mt-2.5 h-3.5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
                      <p className="text-sm font-medium text-rose-300">{error}</p>
                      <button
                        type="button"
                        onClick={() => loadCharacters(1, false)}
                        className="kuro-btn-primary mt-4 min-h-[40px] rounded-xl px-4.5 py-2 text-xs font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  ) : characters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
                      <User className="h-8 w-8 text-slate-500" />
                      <p className="mt-3 text-sm font-semibold text-white">
                        No matching characters found
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Try a different character name or switch back to All Anime.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput('');
                          setSeriesId('all');
                          setCategory('ALL');
                        }}
                        className="kuro-btn-glass mt-4 min-h-[40px] rounded-xl px-4.5 py-2 text-xs font-semibold"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                        {characters.map((ch) => {
                          const isSelected = selectedAvatar.url === ch.imageUrl;
                          return (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => {
                                setSelectedAvatar({
                                  url: ch.imageUrl,
                                  name: ch.name,
                                  series: ch.seriesTitle,
                                  role: ch.role,
                                });
                                setSaveError(null);
                              }}
                              className={`group relative flex flex-col overflow-hidden rounded-2xl border p-2 text-left transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                                isSelected
                                  ? 'border-violet-400 bg-violet-600/20 ring-2 ring-violet-500/70'
                                  : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#141726]">
                                <CharacterPortraitImg
                                  src={ch.imageUrl}
                                  alt={ch.name}
                                  className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                                />
                                {isSelected && (
                                  <span
                                    aria-label="Selected avatar"
                                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow-md"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 min-w-0 px-0.5">
                                <p className="truncate text-xs font-semibold text-white">
                                  {ch.name}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                  {[ch.seriesTitle, ch.role].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Infinite Scroll Sentinel + Manual Load More */}
                      <div ref={loadMoreSentinelRef} className="mt-6 flex justify-center pb-2">
                        {hasNextPage ? (
                          <button
                            type="button"
                            onClick={() => loadCharacters(page + 1, true)}
                            disabled={loadingMore}
                            className="kuro-btn-glass inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-5 py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                                <span>Loading more characters...</span>
                              </>
                            ) : (
                              <span>Load More Characters</span>
                            )}
                          </button>
                        ) : (
                          <p className="text-xs text-slate-500">End of character list</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};

const CharacterPortraitImg: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[#19162b] to-[#11131d] p-2 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="line-clamp-2 text-[11px] font-medium text-slate-400">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
