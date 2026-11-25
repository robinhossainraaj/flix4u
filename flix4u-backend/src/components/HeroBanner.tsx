import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Check, ChevronLeft, ChevronRight, Info, Play, Sparkles } from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { useAuth } from '@/src/context/AuthContext';
import { getDisplayTitle, slugifyTitle, stripHtml } from '@/src/services/anilistApi';
import { isHindiDubbedAnime } from '@/src/services/hindiAnime';
import type { AnimeSummary } from '@/src/types/anime';

interface HeroBannerProps {
  items: AnimeSummary[];
  loading?: boolean;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ items, loading = false }) => {
  const featured = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const { isInWatchlist, toggleWatchlist } = useAuth();

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
      <section className="relative h-[430px] w-full animate-pulse rounded-3xl border border-white/[0.08] bg-[#10121c] sm:h-[520px]" />
    );
  }

  const current = featured[index % featured.length];
  const title = getDisplayTitle(current.title);
  const synopsis = stripHtml(current.description);
  const score = current.averageScore ? (current.averageScore / 10).toFixed(1) : null;
  const inWatchlist = isInWatchlist(current.id);
  const isHindiVerified = isHindiDubbedAnime(current);
  const watchSlug = `${slugifyTitle(current.title.romaji || title) || `anime-${current.id}`}-episode-1`;

  const metaLine = [
    current.format?.replace('_', ' '),
    current.seasonYear,
    current.episodes ? `${current.episodes} Episodes` : null,
    score ? `★ ${score}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      aria-label="Featured Anime"
      className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0b0d15] shadow-2xl shadow-violet-950/30"
    >
      <div className="relative h-[430px] sm:h-[520px] lg:h-[560px] w-full">
        <AnimeImage
          src={current.bannerImage || current.coverImage?.extraLarge || current.coverImage?.large}
          alt={title}
          variant="banner"
          className="h-full w-full object-cover object-center transition-opacity duration-500"
        />

        {/* Cinema scrims + subtle violet ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080d] via-[#07080d]/55 to-[#07080d]/15" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#07080d]/95 via-[#07080d]/70 to-transparent" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />

        <div className="absolute inset-0 flex items-end p-5 sm:p-10 lg:p-12">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-600/20 px-2.5 py-1 text-xs font-semibold text-violet-200 backdrop-blur-md tabular-nums">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                <span>#{index + 1} Spotlight</span>
              </span>
              {isHindiVerified && (
                <span className="inline-flex items-center rounded-lg border border-amber-300/35 bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-[#07080d]">
                  Hindi Dubbed
                </span>
              )}
              {metaLine && (
                <span className="text-xs font-medium text-slate-300 tabular-nums">
                  {metaLine}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl text-balance line-clamp-2">
              {title}
            </h1>

            {current.genres && current.genres.length > 0 && (
              <p className="mt-2 text-xs font-medium text-violet-300/90">
                {current.genres.slice(0, 4).join(' · ')}
              </p>
            )}

            <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-300 line-clamp-2 sm:line-clamp-3 max-w-xl">
              {synopsis}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <Link
                to={`/watch/${current.id}/${encodeURIComponent(watchSlug)}?ep=1`}
                className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Watch Now</span>
              </Link>
              <Link
                to={`/anime/${current.id}`}
                className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium whitespace-nowrap shrink-0"
              >
                <Info className="h-4 w-4" />
                <span>Details</span>
              </Link>
              <button
                type="button"
                onClick={() => toggleWatchlist(current)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 ${
                  inWatchlist ? 'kuro-btn-active' : 'kuro-btn-glass'
                }`}
              >
                {inWatchlist ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                <span>{inWatchlist ? 'In Watchlist' : 'Add to List'}</span>
              </button>
            </div>
          </div>
        </div>

        {featured.length > 1 && (
          <div className="absolute top-4 right-4 sm:top-auto sm:bottom-6 sm:right-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev - 1 + featured.length) % featured.length)}
              aria-label="Previous featured anime"
              className="kuro-btn-glass hidden sm:flex h-9 w-9 items-center justify-center rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#07080d]/65 px-2.5 py-1.5 backdrop-blur-xl">
              {featured.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show featured anime ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === index ? 'w-6 bg-violet-400' : 'w-1.5 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev + 1) % featured.length)}
              aria-label="Next featured anime"
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
