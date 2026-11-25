import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { BADGE_ARTWORK_MAP } from '@/src/assets/badgeArtwork';
import {
  ACHIEVEMENT_BADGES,
  formatUnlockDate,
  formatWatchDuration,
  MAX_EQUIPPED_BADGES,
  resolveEffectiveBadges,
  type ResolvedBadgeProgress,
} from '@/src/services/achievementService';
import type {
  AchievementBadge,
  AchievementId,
  EquipBadgeResult,
  UserWatchStats,
} from '@/src/types/anime';

interface AchievementsSectionProps {
  stats: UserWatchStats;
  isAdmin?: boolean;
  variant?: 'compact' | 'full';
  onViewAll?: () => void;
  equippedBadgeIds?: AchievementId[];
  maxEquipped?: number;
  onToggleEquipBadge?: (badgeId: AchievementId) => Promise<EquipBadgeResult>;
  equippingBadgeId?: AchievementId | null;
}

type BadgeFilter = 'all' | 'unlocked' | 'locked';

interface ResolvedBadgeEntry {
  badge: AchievementBadge;
  progress: ResolvedBadgeProgress;
}

const FallbackSvgCrest: React.FC<{ badge: AchievementBadge; unlocked: boolean }> = ({
  badge,
  unlocked,
}) => {
  const gradId = `badge-fallback-grad-${badge.id}`;
  const accent = unlocked ? badge.accentHex : '#475569';
  const secondary = unlocked ? badge.secondaryHex : '#334155';

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#0b0d17]">
      <svg
        viewBox="0 0 64 64"
        className={`h-3/4 w-3/4 ${unlocked ? 'opacity-95' : 'opacity-40 grayscale'}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={secondary} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>
        <polygon
          points="32,4 50,12 60,32 50,52 32,60 14,52 4,32 14,12"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle
          cx="32"
          cy="32"
          r="20"
          fill={unlocked ? `${badge.accentHex}1f` : 'rgba(255,255,255,0.03)'}
          stroke={`url(#${gradId})`}
          strokeWidth="1.5"
        />
      </svg>
      <span
        className={`absolute text-3xl sm:text-4xl leading-none select-none ${
          unlocked ? 'drop-shadow-[0_3px_8px_rgba(0,0,0,0.85)]' : 'opacity-50 grayscale'
        }`}
        aria-hidden="true"
      >
        {badge.emoji}
      </span>
    </div>
  );
};

interface BadgeArtworkTileProps {
  badge: AchievementBadge;
  unlocked: boolean;
  equipped?: boolean;
  size?: 'grid' | 'detail';
  priority?: boolean;
}

const BadgeArtworkTile: React.FC<BadgeArtworkTileProps> = ({
  badge,
  unlocked,
  equipped = false,
  size = 'grid',
  priority = false,
}) => {
  const artworkSrc = BADGE_ARTWORK_MAP[badge.id];
  const [imgFailed, setImgFailed] = useState(false);

  const containerSize =
    size === 'detail'
      ? 'h-36 w-36 sm:h-44 sm:w-44 rounded-3xl'
      : 'aspect-square w-full rounded-2xl';

  return (
    <div
      className={`relative overflow-hidden border transition-all duration-300 ${containerSize}`}
      style={{
        borderColor: equipped
          ? badge.secondaryHex
          : unlocked
            ? `${badge.accentHex}99`
            : 'rgba(255,255,255,0.1)',
        background: unlocked
          ? `radial-gradient(circle at 50% 35%, ${badge.accentHex}2a, #090b14 80%)`
          : '#080a12',
        boxShadow: unlocked
          ? size === 'detail'
            ? `0 0 38px -4px ${badge.accentHex}85, inset 0 0 22px -6px ${badge.secondaryHex}55`
            : equipped
              ? `0 0 24px -3px ${badge.accentHex}99, inset 0 0 14px -4px ${badge.secondaryHex}66`
              : `0 0 20px -4px ${badge.accentHex}75, inset 0 0 12px -4px ${badge.secondaryHex}40`
          : undefined,
      }}
    >
      {artworkSrc && !imgFailed ? (
        <img
          src={artworkSrc}
          alt={badge.title}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`h-full w-full object-cover transition-transform duration-300 ${
            unlocked
              ? 'scale-[1.03] group-hover:scale-110 brightness-105 saturate-110'
              : 'grayscale brightness-[0.58] contrast-95 opacity-60'
          }`}
        />
      ) : (
        <FallbackSvgCrest badge={badge} unlocked={unlocked} />
      )}

      {/* Subtle top-edge neon rim sheen for unlocked badges */}
      {unlocked && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            boxShadow: `inset 0 1px 0 0 ${badge.secondaryHex}66`,
          }}
        />
      )}

      {/* Equipped indicator on tile */}
      {unlocked && equipped && (
        <span
          aria-label="Equipped on profile"
          className={`absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-violet-600/90 text-white shadow-md ring-1 ring-white/30 backdrop-blur-sm ${
            size === 'detail' ? 'px-2.5 py-1 text-[11px] font-bold' : 'px-1.5 py-0.5 text-[9px] font-bold'
          }`}
        >
          <Award className={size === 'detail' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />
          <span>Profile</span>
        </span>
      )}

      {/* Darkened vignette + Lock icon overlay for locked badges */}
      {!unlocked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060810]/40">
          <span
            aria-label="Locked badge"
            className={`flex items-center justify-center rounded-full border border-white/20 bg-[#0b0d17]/90 text-slate-200 shadow-lg backdrop-blur-sm ${
              size === 'detail' ? 'h-12 w-12' : 'h-8 w-8 sm:h-9 sm:w-9'
            }`}
          >
            <Lock className={size === 'detail' ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} />
          </span>
        </div>
      )}

      {/* Earned check marker */}
      {unlocked && (
        <span
          aria-label="Unlocked badge"
          className={`absolute bottom-1.5 right-1.5 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-[#0b0d17] ${
            size === 'detail' ? 'h-7 w-7' : 'h-5 w-5'
          }`}
        >
          <CheckCircle2 className={size === 'detail' ? 'h-4 w-4' : 'h-3 w-3'} />
        </span>
      )}
    </div>
  );
};

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({
  stats,
  isAdmin = false,
  variant = 'full',
  onViewAll,
  equippedBadgeIds = [],
  maxEquipped = MAX_EQUIPPED_BADGES,
  onToggleEquipBadge,
  equippingBadgeId = null,
}) => {
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const showFeedback = (type: 'success' | 'warning' | 'error', text: string) => {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setActionFeedback({ type, text });
    feedbackTimerRef.current = window.setTimeout(() => {
      setActionFeedback(null);
    }, 3600);
  };

  const equippedSet = useMemo(() => new Set<string>(equippedBadgeIds), [equippedBadgeIds]);

  const resolvedBadges = useMemo<ResolvedBadgeEntry[]>(
    () => resolveEffectiveBadges(stats, isAdmin),
    [stats, isAdmin]
  );

  const unlockedCount = useMemo(
    () => resolvedBadges.filter((item) => item.progress.unlocked).length,
    [resolvedBadges]
  );
  const totalCount = ACHIEVEMENT_BADGES.length;
  const completionPercentage =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Compact showcase right below Daily Watch Activity Calendar:
  // - Admin sees ALL unlocked badges directly in the 3-col grid.
  // - Normal users see ALL earned badges plus upcoming locked badges (min 6 cards so progress is visible).
  const compactBadges = useMemo<ResolvedBadgeEntry[]>(() => {
    if (isAdmin) {
      return resolvedBadges;
    }
    const earned = resolvedBadges.filter((b) => b.progress.unlocked);
    const locked = resolvedBadges.filter((b) => !b.progress.unlocked);

    if (earned.length >= 7) {
      return [...earned, ...locked];
    }

    const lockedNeeded = Math.max(0, 6 - earned.length);
    return [...earned, ...locked.slice(0, lockedNeeded)];
  }, [resolvedBadges, isAdmin]);

  const fullFilteredBadges = useMemo<ResolvedBadgeEntry[]>(() => {
    if (filter === 'unlocked') {
      return resolvedBadges.filter((b) => b.progress.unlocked);
    }
    if (filter === 'locked') {
      return resolvedBadges.filter((b) => !b.progress.unlocked);
    }
    return resolvedBadges;
  }, [resolvedBadges, filter]);

  const displayedBadges = variant === 'compact' ? compactBadges : fullFilteredBadges;
  const selectedIndex = selectedBadgeId
    ? resolvedBadges.findIndex((item) => item.badge.id === selectedBadgeId)
    : -1;
  const selectedEntry = selectedIndex >= 0 ? resolvedBadges[selectedIndex] : null;

  useEffect(() => {
    if (!selectedEntry) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBadgeId(null);
      } else if (e.key === 'ArrowRight') {
        const nextIdx = (selectedIndex + 1) % resolvedBadges.length;
        setSelectedBadgeId(resolvedBadges[nextIdx].badge.id);
      } else if (e.key === 'ArrowLeft') {
        const prevIdx = (selectedIndex - 1 + resolvedBadges.length) % resolvedBadges.length;
        setSelectedBadgeId(resolvedBadges[prevIdx].badge.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEntry, selectedIndex, resolvedBadges]);

  const handleEquipToggle = async (badge: AchievementBadge, unlocked: boolean) => {
    if (!unlocked || !onToggleEquipBadge) return;
    const result = await onToggleEquipBadge(badge.id);
    if (result.message) {
      if (result.ok) {
        showFeedback('success', result.message);
      } else if (result.reason === 'max_limit' || result.reason === 'locked') {
        showFeedback('warning', result.message);
      } else {
        showFeedback('error', result.message);
      }
    }
  };

  const renderBadgeCard = ({ badge, progress }: ResolvedBadgeEntry, idx: number) => {
    const unlockDateText = formatUnlockDate(progress.unlockedAt);
    const earnedCaption = progress.isAdminUnlock
      ? 'Admin Free'
      : unlockDateText || 'Earned';
    const isEquipped = progress.unlocked && equippedSet.has(badge.id);
    const isBusy = equippingBadgeId === badge.id;

    return (
      <div
        key={badge.id}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-2.5 sm:p-3.5 transition-all duration-300 ${
          progress.unlocked
            ? 'bg-[#101222]/90 hover:-translate-y-0.5'
            : 'kuro-glass border-white/[0.08] bg-[#0b0d17]/75 hover:border-violet-400/35'
        }`}
        style={{
          borderColor: isEquipped
            ? badge.secondaryHex
            : progress.unlocked
              ? `${badge.accentHex}66`
              : undefined,
          background: progress.unlocked
            ? `linear-gradient(165deg, ${badge.accentHex}1c 0%, rgba(11,13,24,0.96) 62%)`
            : undefined,
          boxShadow: isEquipped
            ? `0 0 26px -8px ${badge.accentHex}aa`
            : progress.unlocked
              ? `0 10px 26px -12px ${badge.accentHex}6e`
              : undefined,
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedBadgeId(badge.id)}
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-xl"
        >
          <BadgeArtworkTile
            badge={badge}
            unlocked={progress.unlocked}
            equipped={isEquipped}
            priority={idx < 6}
          />

          <h3
            className={`mt-2.5 text-center text-[11px] sm:text-xs font-bold leading-snug line-clamp-2 ${
              progress.unlocked ? 'text-white' : 'text-slate-300'
            }`}
          >
            {badge.title}
          </h3>

          {/* Status / Progress Footer */}
          <div className="mt-1.5 w-full">
            {progress.unlocked ? (
              <p
                className="truncate text-center text-[10px] font-semibold tabular-nums"
                style={{ color: badge.secondaryHex }}
              >
                {earnedCaption}
              </p>
            ) : (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/[0.06] bg-black/60">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(progress.percent > 0 ? 8 : 0, progress.percent)}%`,
                      background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
                    }}
                  />
                </div>
                <p className="truncate text-center font-mono text-[10px] font-medium text-slate-400 tabular-nums">
                  {progress.progressText}
                </p>
              </div>
            )}
          </div>
        </button>

        {/* Equip Button ONLY for unlocked badges (Admin & Earned Users) */}
        {progress.unlocked && onToggleEquipBadge && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleEquipToggle(badge, progress.unlocked)}
            className={`mt-2.5 inline-flex min-h-[34px] sm:min-h-[36px] w-full items-center justify-center gap-1 rounded-xl border px-2 py-1 text-[10px] sm:text-[11px] font-bold transition-all active:scale-[0.97] disabled:opacity-60 ${
              isEquipped
                ? 'border-rose-400/45 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 hover:border-rose-300'
                : 'border-violet-400/50 bg-violet-600/25 text-violet-100 hover:bg-violet-600/40 hover:border-violet-300'
            }`}
          >
            {isBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isEquipped ? (
              <>
                <Trash2 className="h-3 w-3 shrink-0" />
                <span className="truncate">Remove from Profile</span>
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 shrink-0" />
                <span className="truncate">Add to Profile</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="kuro-glass relative overflow-hidden rounded-3xl border border-violet-500/25 p-4 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-violet-600/20 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-500/20 text-violet-300 shadow-[0_0_16px_rgba(139,92,246,0.35)]">
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white">
                  {variant === 'compact'
                    ? 'Achievement Badge Collection'
                    : 'Complete Badge Collection'}
                </h2>
                <p className="text-xs text-slate-300 tabular-nums">
                  {unlockedCount} of {totalCount} badges unlocked ({completionPercentage}%)
                  {onToggleEquipBadge && (
                    <span className="ml-2 font-semibold text-violet-300">
                      · {equippedBadgeIds.length} / {maxEquipped} on My Badges
                    </span>
                  )}
                </p>
              </div>
              {isAdmin && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/45 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Admin All-Access</span>
                </span>
              )}
            </div>
          </div>

          {variant === 'compact' && onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="kuro-btn-active inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <Sparkles className="h-4 w-4 text-violet-200" />
              <span>View All Badges</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-3 self-start rounded-2xl border border-white/[0.1] bg-[#0b0d17]/90 px-4 py-2.5 sm:self-auto">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Unlocked
                </span>
                <span className="text-base sm:text-lg font-black text-white tabular-nums">
                  {unlockedCount}{' '}
                  <span className="text-xs font-semibold text-slate-400">/ {totalCount}</span>
                </span>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Watch Time
                </span>
                <span className="text-base sm:text-lg font-black text-violet-300 tabular-nums">
                  {formatWatchDuration(stats.totalWatchSeconds || 0, 'compact')}
                </span>
              </div>
              <div className="h-7 w-px bg-white/10" />
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Episodes
                </span>
                <span className="text-base sm:text-lg font-black text-fuchsia-300 tabular-nums">
                  {stats.totalEpisodesCompleted || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Mastery Progress + Filter Tabs (Full View) */}
        <div className="relative z-10 mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">
                {isAdmin
                  ? 'Authorized Admin Privilege — every existing & future badge unlocked'
                  : 'Collection Mastery Progress'}
              </span>
              <span className="text-violet-300 tabular-nums">{completionPercentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-white/[0.08] bg-black/50 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${completionPercentage}%`,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #d946ef 100%)',
                }}
              />
            </div>
          </div>

          {variant === 'full' && (
            <div className="inline-flex items-center gap-1 rounded-2xl border border-white/[0.1] bg-[#0a0c15] p-1 self-start sm:self-auto">
              {(
                [
                  { id: 'all', label: `All (${totalCount})` },
                  { id: 'unlocked', label: `Unlocked (${unlockedCount})` },
                  { id: 'locked', label: `Locked (${totalCount - unlockedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === tab.id
                      ? 'bg-violet-600/35 text-white border border-violet-400/50'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Inline Feedback Toast Banner for Equip / Limit Warnings */}
        {actionFeedback && (
          <div
            role="status"
            className={`relative z-10 mt-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-xs font-semibold ${
              actionFeedback.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : actionFeedback.type === 'warning'
                  ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                  : 'border-rose-400/45 bg-rose-500/15 text-rose-200'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {actionFeedback.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate sm:whitespace-normal">{actionFeedback.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-lg p-1 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3-Column Mobile Grid (expands cleanly on tablet/desktop) */}
      {displayedBadges.length === 0 ? (
        <div className="kuro-glass rounded-3xl border border-white/[0.08] p-10 text-center">
          <p className="text-sm font-semibold text-white">
            {filter === 'unlocked'
              ? 'No badges unlocked yet'
              : 'All available badges are unlocked!'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {filter === 'unlocked'
              ? 'Watch anime episodes to start earning collector badges.'
              : 'Amazing dedication across Flix4U.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3.5 md:grid-cols-5">
          {displayedBadges.map((entry, idx) => renderBadgeCard(entry, idx))}
        </div>
      )}

      {/* Subtle footer shortcut if compact view is previewing a subset */}
      {variant === 'compact' && onViewAll && displayedBadges.length < resolvedBadges.length && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onViewAll}
            className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-violet-500/35 px-5 py-2 text-xs font-semibold text-violet-200 hover:border-violet-400 hover:text-white"
          >
            <span>
              View All Badges ({totalCount})
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Badge Inspector Modal */}
      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedEntry.badge.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setSelectedBadgeId(null)}
        >
          <div
            className="kuro-glass relative w-full max-w-md overflow-hidden rounded-3xl border border-violet-500/40 bg-[#0d101d] p-6 shadow-[0_25px_70px_-15px_rgba(139,92,246,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedBadgeId(null)}
              aria-label="Close badge details"
              className="kuro-btn-glass absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <BadgeArtworkTile
                badge={selectedEntry.badge}
                unlocked={selectedEntry.progress.unlocked}
                equipped={
                  selectedEntry.progress.unlocked &&
                  equippedSet.has(selectedEntry.badge.id)
                }
                size="detail"
                priority
              />

              <span
                className="mt-4 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  color: selectedEntry.progress.unlocked
                    ? selectedEntry.badge.secondaryHex
                    : '#94a3b8',
                }}
              >
                {selectedEntry.badge.tier} · {selectedEntry.badge.badgeLabel}
              </span>

              <h3 className="mt-1 text-xl font-black text-white">
                {selectedEntry.badge.emoji} {selectedEntry.badge.title}
              </h3>

              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-300">
                {selectedEntry.badge.description}
              </p>

              {/* Progress Panel */}
              <div className="mt-5 w-full space-y-2 rounded-2xl border border-white/[0.08] bg-[#080a12]/90 p-4 text-left">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className={
                      selectedEntry.progress.unlocked
                        ? 'inline-flex items-center gap-1.5 font-semibold text-emerald-400'
                        : 'inline-flex items-center gap-1.5 font-medium text-slate-400'
                    }
                  >
                    {selectedEntry.progress.unlocked ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          {selectedEntry.progress.isAdminUnlock
                            ? 'Permanent Admin Unlock'
                            : formatUnlockDate(selectedEntry.progress.unlockedAt)
                            ? `Unlocked · ${formatUnlockDate(selectedEntry.progress.unlockedAt)}`
                            : 'Unlocked'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span>Unlock Progress</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-200 tabular-nums">
                    {selectedEntry.progress.progressText}
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/[0.06] bg-black/60">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${selectedEntry.progress.percent}%`,
                      background: selectedEntry.progress.unlocked
                        ? `linear-gradient(90deg, ${selectedEntry.badge.accentHex}, ${selectedEntry.badge.secondaryHex})`
                        : 'linear-gradient(90deg, #7c3aed, #c084fc)',
                    }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>Completion</span>
                  <span>{selectedEntry.progress.percent}%</span>
                </div>
              </div>

              {/* Add / Remove from Profile inside Inspector Modal (ONLY for unlocked badges) */}
              {selectedEntry.progress.unlocked && onToggleEquipBadge && (
                <div className="mt-4 w-full space-y-2">
                  <button
                    type="button"
                    disabled={equippingBadgeId === selectedEntry.badge.id}
                    onClick={() =>
                      void handleEquipToggle(
                        selectedEntry.badge,
                        selectedEntry.progress.unlocked
                      )
                    }
                    className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-xs sm:text-sm font-bold transition-all disabled:opacity-60 ${
                      equippedSet.has(selectedEntry.badge.id)
                        ? 'border-rose-400/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                        : 'kuro-btn-primary border-violet-400/60 text-white shadow-lg'
                    }`}
                  >
                    {equippingBadgeId === selectedEntry.badge.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : equippedSet.has(selectedEntry.badge.id) ? (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>Remove from Profile</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Add to Profile</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {equippedBadgeIds.length} of {maxEquipped} badges displayed on My Badges
                  </p>
                  {actionFeedback && (
                    <p
                      className={`text-xs font-semibold ${
                        actionFeedback.type === 'success'
                          ? 'text-emerald-300'
                          : actionFeedback.type === 'warning'
                            ? 'text-amber-300'
                            : 'text-rose-300'
                      }`}
                    >
                      {actionFeedback.text}
                    </p>
                  )}
                </div>
              )}

              {/* Prev / Next Navigation */}
              <div className="mt-4 flex w-full items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const prevIdx =
                      (selectedIndex - 1 + resolvedBadges.length) % resolvedBadges.length;
                    setSelectedBadgeId(resolvedBadges[prevIdx].badge.id);
                  }}
                  className="kuro-btn-glass inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>
                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                  {selectedIndex + 1} / {resolvedBadges.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (selectedIndex + 1) % resolvedBadges.length;
                    setSelectedBadgeId(resolvedBadges[nextIdx].badge.id);
                  }}
                  className="kuro-btn-glass inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-200"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
