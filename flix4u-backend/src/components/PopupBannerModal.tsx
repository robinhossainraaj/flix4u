import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowUpRight, Sparkles, X } from 'lucide-react';
import { resolveApiUrl } from '@/src/config/env';
import { useAuth } from '@/src/context/AuthContext';
import {
  getAnalyticsClientId,
  isBannerCurrentlyScheduled,
  isValidDestinationUrl,
  subscribeActiveBanners,
} from '@/src/services/adminService';
import type { PopupBanner } from '@/src/types/anime';

const SESSION_SEEN_PREFIX = 'flix4u_banner_session_v1_';
const DAY_SEEN_PREFIX = 'flix4u_banner_day_v1_';
const USER_SEEN_PREFIX = 'flix4u_banner_user_v1_';

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasBannerBeenSeen(
  banner: PopupBanner,
  actorKey: string,
  launchSeenIds: Set<string>
): boolean {
  if (launchSeenIds.has(banner.id)) return true;

  try {
    if (banner.frequency === 'once_per_session') {
      return sessionStorage.getItem(`${SESSION_SEEN_PREFIX}${banner.id}`) === '1';
    }
    if (banner.frequency === 'once_per_day') {
      return localStorage.getItem(`${DAY_SEEN_PREFIX}${banner.id}`) === getTodayKey();
    }
    if (banner.frequency === 'once_per_user') {
      return localStorage.getItem(`${USER_SEEN_PREFIX}${actorKey}_${banner.id}`) === '1';
    }
  } catch {
    // ignore storage restriction
  }
  return false;
}

function markBannerSeen(
  banner: PopupBanner,
  actorKey: string,
  launchSeenIds: Set<string>
): void {
  launchSeenIds.add(banner.id);
  try {
    if (banner.frequency === 'once_per_session') {
      sessionStorage.setItem(`${SESSION_SEEN_PREFIX}${banner.id}`, '1');
    } else if (banner.frequency === 'once_per_day') {
      localStorage.setItem(`${DAY_SEEN_PREFIX}${banner.id}`, getTodayKey());
    } else if (banner.frequency === 'once_per_user') {
      localStorage.setItem(`${USER_SEEN_PREFIX}${actorKey}_${banner.id}`, '1');
    }
  } catch {
    // ignore storage restriction
  }
}

export interface PopupBannerCardProps {
  banner: Pick<
    PopupBanner,
    'title' | 'description' | 'imageUrl' | 'buttonText' | 'destinationUrl' | 'openInNewTab'
  >;
  onClose: () => void;
  onCtaClick?: () => void;
  previewBadge?: string;
}

export const PopupBannerCard: React.FC<PopupBannerCardProps> = ({
  banner,
  onClose,
  onCtaClick,
  previewBadge,
}) => {
  const navigate = useNavigate();
  const dest = banner.destinationUrl?.trim() || '';
  const hasCta = Boolean(banner.buttonText?.trim() && dest && isValidDestinationUrl(dest));
  const isInternal = dest.startsWith('/');

  const handleInternalCta = () => {
    if (onCtaClick) onCtaClick();
    onClose();
    if (isInternal) {
      navigate(dest);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={banner.title || 'Announcement Banner'}
      className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-violet-400/25 bg-[#0d101b]/95 shadow-[0_28px_80px_-12px_rgba(88,28,135,0.65)] backdrop-blur-2xl"
    >
      {/* Top-right Close Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close popup banner"
        className="kuro-btn-glass absolute right-3.5 top-3.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-md hover:bg-black/75"
      >
        <X className="h-4.5 w-4.5" />
      </button>

      {/* Banner Image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#131626]">
        {banner.imageUrl ? (
          <img
            src={resolveApiUrl(banner.imageUrl)}
            alt={banner.title || 'Promotional banner'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-950/80 via-[#141728] to-purple-950/60 text-xs text-slate-400">
            No banner image provided
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d101b] via-[#0d101b]/20 to-transparent"
        />
        {previewBadge && (
          <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-950/80 px-2.5 py-1 text-[11px] font-semibold text-violet-200 backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            {previewBadge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3.5 px-5 pb-6 pt-3 sm:px-6">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">
          {banner.title || 'Announcement'}
        </h2>
        {banner.description?.trim() && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {banner.description}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="kuro-btn-glass inline-flex min-h-[42px] items-center justify-center rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold text-slate-200"
          >
            Dismiss
          </button>

          {hasCta &&
            (isInternal ? (
              <button
                type="button"
                onClick={handleInternalCta}
                className="kuro-btn-primary inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl px-5 py-2 text-xs sm:text-sm font-semibold text-white"
              >
                <span>{banner.buttonText}</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            ) : (
              <a
                href={dest}
                target={banner.openInNewTab ? '_blank' : undefined}
                rel={banner.openInNewTab ? 'noopener noreferrer' : undefined}
                onClick={() => {
                  if (onCtaClick) onCtaClick();
                  onClose();
                }}
                className="kuro-btn-primary inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl px-5 py-2 text-xs sm:text-sm font-semibold text-white"
              >
                <span>{banner.buttonText}</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ))}
        </div>
      </div>
    </div>
  );
};

export const PopupBannerModal: React.FC = () => {
  const { user, authReady } = useAuth();
  const [banners, setBanners] = useState<PopupBanner[]>([]);
  const [activeBanner, setActiveBanner] = useState<PopupBanner | null>(null);
  const launchSeenIdsRef = useRef<Set<string>>(new Set());
  const evaluatedOnLaunchRef = useRef(false);

  const actorKey = useMemo(() => user?.uid || getAnalyticsClientId(), [user?.uid]);

  useEffect(() => {
    const unsub = subscribeActiveBanners((items) => {
      setBanners(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || banners.length === 0) return;
    // Trigger once per site open/launch (not repeatedly on route navigation)
    if (evaluatedOnLaunchRef.current) return;

    const nowMs = Date.now();
    const eligible = banners.find(
      (b) => isBannerCurrentlyScheduled(b, nowMs) && !hasBannerBeenSeen(b, actorKey, launchSeenIdsRef.current)
    );

    evaluatedOnLaunchRef.current = true;
    if (eligible) {
      markBannerSeen(eligible, actorKey, launchSeenIdsRef.current);
      setActiveBanner(eligible);
    }
  }, [authReady, banners, actorKey]);

  useEffect(() => {
    if (!activeBanner) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveBanner(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBanner]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {activeBanner && (
          <motion.div
            key={activeBanner.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setActiveBanner(null);
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg"
            >
              <PopupBannerCard
                banner={activeBanner}
                onClose={() => setActiveBanner(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};
