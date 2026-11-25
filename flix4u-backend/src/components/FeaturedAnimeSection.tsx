import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Check, ChevronRight, Play } from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { useAuth } from '@/src/context/AuthContext';
import { getDisplayTitle, stripHtml } from '@/src/services/anilistApi';
import { isHindiDubbedAnime } from '@/src/services/hindiAnime';
import type { AnimeSummary } from '@/src/types/anime';

interface FeaturedAnimeSectionProps {
  items: AnimeSummary[];
  loading?: boolean;
}

export const FeaturedAnimeSection: React.FC<FeaturedAnimeSectionProps> = ({
  items,
  loading = false,
}) => {
  const { isInWatchlist, toggleWatchlist } = useAuth();

  return (
    <section aria-label="Featured Anime" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Featured Anime
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
            Fan-favorite classics ready in Hindi Dubbed and original audio
          </p>
        </div>

        <Link
          to="/anime?lang=hindi"
          className="kuro-btn-glass inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200 whitespace-nowrap shrink-0"
        >
          <span>Hindi Catalog</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[228px] sm:w-auto shrink-0 space-y-3">
              <div className="aspect-[2/3] w-full animate-pulse rounded-2xl bg-[#121420]" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-[#121420]" />
              <div className="h-3.5 w-full animate-pulse rounded bg-[#121420]" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? null : (
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar pb-2 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible">
          {items.map((anime) => {
            const title = getDisplayTitle(anime.title);
            const description = stripHtml(anime.description);
            const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
            const inWatchlist = isInWatchlist(anime.id);
            const isHindiVerified = isHindiDubbedAnime(anime);
            const posterSrc =
              anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium;

            const metaParts = [
              anime.format ? anime.format.replace('_', ' ') : null,
              anime.seasonYear ? String(anime.seasonYear) : null,
              anime.episodes ? `${anime.episodes} Eps` : null,
              score ? `★ ${score}` : null,
            ].filter(Boolean);

            return (
              <article
                key={anime.id}
                className="group relative flex w-[228px] sm:w-auto shrink-0 snap-start flex-col"
              >
                <Link
                  to={`/anime/${anime.id}`}
                  className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#10121c] shadow-[0_14px_38px_-12px_rgba(124,58,237,0.42)] transition-[transform,border-color,box-shadow] duration-200 ease-out active:scale-[0.98] group-hover:border-violet-400/60 group-hover:shadow-[0_22px_48px_-12px_rgba(139,92,246,0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <AnimeImage
                    src={posterSrc}
                    alt={title}
                    variant="poster"
                    priority
                    className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.05]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080d]/95 via-[#07080d]/25 to-transparent opacity-80 transition-opacity duration-200 group-hover:opacity-95" />

                  {isHindiVerified && (
                    <div className="pointer-events-none absolute top-3 left-3 z-10">
                      <span className="inline-flex items-center rounded-lg border border-amber-300/40 bg-amber-500/95 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#07080d] shadow-md">
                        Hindi Dubbed
                      </span>
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 hidden sm:flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-violet-600/95 text-white shadow-xl shadow-violet-950/80">
                      <Play className="h-6 w-6 translate-x-0.5 fill-current" />
                    </span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleWatchlist(anime);
                  }}
                  aria-label={
                    inWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`
                  }
                  title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                  className={`absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl transition-[opacity,transform,filter,box-shadow] duration-150 ${
                    inWatchlist
                      ? 'kuro-btn-primary'
                      : 'kuro-btn-glass opacity-95 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100'
                  }`}
                >
                  {inWatchlist ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </button>

                <div className="mt-3 space-y-1 px-0.5">
                  <Link
                    to={`/anime/${anime.id}`}
                    className="block text-base sm:text-lg font-bold tracking-tight text-white line-clamp-1 group-hover:text-violet-300 transition-colors"
                    title={title}
                  >
                    {title}
                  </Link>
                  {metaParts.length > 0 && (
                    <p className="text-xs text-slate-400 line-clamp-1 tabular-nums">
                      {metaParts.join(' · ')}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-slate-400 line-clamp-2">
                    {description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
