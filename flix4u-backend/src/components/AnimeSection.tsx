import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimeCard } from '@/src/components/AnimeCard';
import type { AnimeSummary } from '@/src/types/anime';

interface AnimeSectionProps {
  title: string;
  subtitle?: string;
  items: AnimeSummary[];
  viewAllTo?: string;
  loading?: boolean;
  badgeResolver?: (anime: AnimeSummary, index: number) => string | undefined;
}

export const AnimeSection: React.FC<AnimeSectionProps> = React.memo(({
  title,
  subtitle,
  items,
  viewAllTo,
  loading = false,
  badgeResolver,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = Math.max(320, el.clientWidth * 0.8);
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs sm:text-sm text-slate-400">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!loading && items.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 mr-1">
              <button
                type="button"
                onClick={() => scrollCarousel('left')}
                aria-label={`Scroll ${title} left`}
                className="kuro-btn-glass flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel('right')}
                aria-label={`Scroll ${title} right`}
                className="kuro-btn-glass flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {viewAllTo && (
            <Link
              to={viewAllTo}
              className="kuro-btn-glass inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200 whitespace-nowrap shrink-0"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="w-[144px] sm:w-[168px] md:w-[184px] lg:w-[196px] shrink-0 space-y-2.5"
            >
              <div className="aspect-[2/3] w-full animate-pulse rounded-2xl bg-[#121420]" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-[#121420]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#121420]" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="kuro-glass rounded-2xl p-8 text-center text-sm text-slate-400">
          No anime available in this section right now.
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="flex gap-3.5 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar pb-2"
        >
          {items.map((anime, index) => (
            <div
              key={anime.id}
              className="w-[144px] sm:w-[168px] md:w-[184px] lg:w-[196px] shrink-0 snap-start"
            >
              <AnimeCard
                anime={anime}
                badgeText={badgeResolver ? badgeResolver(anime, index) : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
});
