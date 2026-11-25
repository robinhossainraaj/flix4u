import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bookmark,
  Check,
  Dices,
  Flame,
  Info,
  Loader2,
  Play,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { useAuth } from '@/src/context/AuthContext';
import {
  getDisplayTitle,
  getRandomAnime,
  slugifyTitle,
  stripHtml,
} from '@/src/services/anilistApi';
import type { AnimeSummary } from '@/src/types/anime';

interface RandomAnimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAnime?: AnimeSummary | null;
}

export const RandomAnimeModal: React.FC<RandomAnimeModalProps> = ({
  isOpen,
  onClose,
  initialAnime,
}) => {
  const [currentAnime, setCurrentAnime] = useState<AnimeSummary | null>(initialAnime || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollCount, setRollCount] = useState(1);
  const { isInWatchlist, toggleWatchlist } = useAuth();

  const rollNewAnime = async () => {
    setLoading(true);
    setError(null);
    try {
      const anime = await getRandomAnime();
      setCurrentAnime(anime);
      setRollCount((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to find a random anime.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (!currentAnime) {
        rollNewAnime();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialAnime) {
      setCurrentAnime(initialAnime);
    }
  }, [initialAnime]);

  if (!isOpen) return null;

  const title = currentAnime ? getDisplayTitle(currentAnime.title) : 'Picking Anime...';
  const synopsis = currentAnime ? stripHtml(currentAnime.description) : '';
  const score =
    currentAnime && currentAnime.averageScore
      ? (currentAnime.averageScore / 10).toFixed(1)
      : null;
  const inWatchlist = currentAnime ? isInWatchlist(currentAnime.id) : false;
  const watchSlug = currentAnime
    ? `${slugifyTitle(currentAnime.title.romaji || title) || `anime-${currentAnime.id}`}-episode-1`
    : '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="kuro-glass relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/[0.14] shadow-2xl shadow-violet-950/50"
          role="dialog"
          aria-modal="true"
          aria-label="Random Anime Discovery"
        >
          {/* Top Bar Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/25 border border-violet-400/30 text-violet-300">
                <Dices className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Random Anime Discovery</span>
                  <span className="text-[11px] font-semibold text-violet-400 tabular-nums">
                    #{rollCount}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Real, hand-verified anime from Flix4U catalog
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close random anime modal"
              className="kuro-btn-glass flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-5 sm:p-6">
            {loading && !currentAnime ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="text-sm font-medium text-slate-300">Shuffling Flix4U anime...</p>
              </div>
            ) : error && !currentAnime ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
                <p className="text-sm text-rose-300">{error}</p>
                <button
                  type="button"
                  onClick={rollNewAnime}
                  className="kuro-btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  <Dices className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </button>
              </div>
            ) : currentAnime ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                  {/* Poster Column */}
                  <div className="sm:col-span-5 relative group overflow-hidden rounded-2xl border border-white/[0.12] bg-[#121422] aspect-[3/4] shadow-xl">
                    <AnimeImage
                      src={
                        currentAnime.coverImage?.extraLarge ||
                        currentAnime.coverImage?.large ||
                        currentAnime.bannerImage
                      }
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Format & Rating Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                      {score && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-[#07080d]/85 px-2 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md tabular-nums">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{score}</span>
                        </span>
                      )}
                      {currentAnime.format && (
                        <span className="inline-flex items-center rounded-lg border border-white/20 bg-[#07080d]/85 px-2 py-0.5 text-[11px] font-semibold text-slate-200 backdrop-blur-md">
                          {currentAnime.format.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details Column */}
                  <div className="sm:col-span-7 flex flex-col justify-between h-full space-y-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {currentAnime.seasonYear && <span>{currentAnime.seasonYear}</span>}
                        {currentAnime.episodes && (
                          <>
                            <span>·</span>
                            <span>{currentAnime.episodes} Episodes</span>
                          </>
                        )}
                        {currentAnime.status && (
                          <>
                            <span>·</span>
                            <span className="capitalize text-emerald-400">
                              {currentAnime.status.toLowerCase().replace('_', ' ')}
                            </span>
                          </>
                        )}
                      </div>

                      <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-white line-clamp-2">
                        {title}
                      </h2>

                      {currentAnime.title.native && (
                        <p className="text-xs text-slate-400 italic">
                          {currentAnime.title.native}
                        </p>
                      )}

                      {/* Genres */}
                      {currentAnime.genres && currentAnime.genres.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {currentAnime.genres.slice(0, 4).map((g) => (
                            <span
                              key={g}
                              className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-300 line-clamp-4">
                        {synopsis}
                      </p>
                    </div>

                    {/* Quick Stats Banner */}
                    <div className="rounded-xl border border-white/[0.08] bg-[#0c0e18]/80 p-2.5 flex items-center justify-around text-center text-xs">
                      <div>
                        <span className="block text-[10px] text-slate-400">AniList Score</span>
                        <span className="font-bold text-amber-300">
                          {currentAnime.averageScore ? `${currentAnime.averageScore}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="block text-[10px] text-slate-400">Popularity</span>
                        <span className="font-bold text-violet-300 tabular-nums">
                          #{currentAnime.popularity || 'Top'}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="block text-[10px] text-slate-400">Status</span>
                        <span className="font-bold text-slate-200">
                          {currentAnime.episodes ? `${currentAnime.episodes} Ep` : 'Ongoing'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      to={`/watch/${currentAnime.id}/${encodeURIComponent(watchSlug)}?ep=1`}
                      onClick={onClose}
                      className="kuro-btn-primary inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Watch Now</span>
                    </Link>

                    <Link
                      to={`/anime/${currentAnime.id}`}
                      onClick={onClose}
                      className="kuro-btn-glass inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap text-slate-200"
                    >
                      <Info className="h-4 w-4" />
                      <span>Details</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => toggleWatchlist(currentAnime)}
                      className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap ${
                        inWatchlist ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                      }`}
                    >
                      {inWatchlist ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                      <span>{inWatchlist ? 'In Watchlist' : 'Add to List'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={rollNewAnime}
                    disabled={loading}
                    className="kuro-btn-active inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap text-white disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Dices className="h-4 w-4 text-violet-300" />
                    )}
                    <span>{loading ? 'Rolling...' : '🎲 Try Another'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
