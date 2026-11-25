import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Check, Play } from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { useAuth } from '@/src/context/AuthContext';
import { getDisplayTitle } from '@/src/services/anilistApi';
import { isHindiDubbedAnime } from '@/src/services/hindiAnime';
import type { AnimeSummary } from '@/src/types/anime';

interface AnimeCardProps {
  anime: AnimeSummary;
  badgeText?: string;
  showHindiBadge?: boolean;
  priorityImage?: boolean;
}

export const AnimeCard: React.FC<AnimeCardProps> = React.memo(({
  anime,
  badgeText,
  showHindiBadge = true,
  priorityImage = false,
}) => {
  const { isInWatchlist, toggleWatchlist } = useAuth();
  const inWatchlist = isInWatchlist(anime.id);
  const title = getDisplayTitle(anime.title);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const isHindiVerified = showHindiBadge && isHindiDubbedAnime(anime);

  // Prefer AniList's highest resolution poster (`extraLarge` maps to /cover/large/)
  const highResPoster =
    anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium;

  const epCount = anime.nextAiringEpisode?.episode
    ? `Ep ${Math.max(1, anime.nextAiringEpisode.episode - 1)}`
    : anime.episodes
      ? `${anime.episodes} Eps`
      : null;

  const metaParts = [
    anime.format ? anime.format.replace('_', ' ') : null,
    anime.seasonYear ? String(anime.seasonYear) : null,
    epCount,
    score ? `★ ${score}` : null,
  ].filter(Boolean);

  return (
    <article className="group relative flex flex-col">
      <Link
        to={`/anime/${anime.id}`}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/[0.09] bg-[#10121c] shadow-[0_10px_28px_-10px_rgba(91,33,182,0.32)] transition-[transform,border-color,box-shadow] duration-200 ease-out active:scale-[0.97] group-hover:border-violet-400/60 group-hover:shadow-[0_18px_40px_-10px_rgba(139,92,246,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <AnimeImage
          src={highResPoster}
          alt={title}
          variant="poster"
          priority={priorityImage}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.06]"
        />

        {/* Cinema bottom scrim for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080d]/95 via-[#07080d]/20 to-transparent opacity-80 transition-opacity duration-200 group-hover:opacity-95" />

        {/* Verified Hindi Dubbed corner badge */}
        {isHindiVerified && (
          <div className="pointer-events-none absolute top-2.5 left-2.5 z-10">
            <span className="inline-flex items-center rounded-lg border border-amber-300/40 bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#07080d] shadow-md">
              Hindi Dubbed
            </span>
          </div>
        )}

        {/* Center Play hover affordance */}
        <div className="pointer-events-none absolute inset-0 hidden sm:flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-violet-600/95 text-white shadow-xl shadow-violet-950/80">
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          </span>
        </div>

        {/* Context badge (Trending / New Episode / Airing) inside bottom scrim */}
        {badgeText && (
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 z-10">
            <span className="inline-flex items-center rounded-lg border border-violet-400/35 bg-[#0b0d17]/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-200 tabular-nums shadow-sm">
              {badgeText}
            </span>
          </div>
        )}
      </Link>

      {/* Watchlist quick button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWatchlist(anime);
        }}
        aria-label={inWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
        title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
        className={`absolute top-2.5 right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-xl transition-[opacity,transform,filter,box-shadow] duration-150 ${
          inWatchlist
            ? 'kuro-btn-primary'
            : 'kuro-btn-glass opacity-95 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        {inWatchlist ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      </button>

      {/* Clean unboxed Title & Metadata below poster */}
      <div className="mt-2.5 flex flex-col gap-0.5 px-0.5">
        <Link
          to={`/anime/${anime.id}`}
          className="text-sm font-semibold leading-snug text-slate-100 line-clamp-1 group-hover:text-violet-300 transition-colors"
          title={title}
        >
          {title}
        </Link>
        {metaParts.length > 0 && (
          <p className="text-xs text-slate-400 line-clamp-1 tabular-nums">
            {metaParts.join(' · ')}
          </p>
        )}
      </div>
    </article>
  );
});
