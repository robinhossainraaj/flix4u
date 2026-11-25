import React from 'react';
import {
  CheckCircle2,
  Crown,
  Flame,
  Infinity as InfinityIcon,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import {
  getLevelTier,
  XP_DAILY_GOAL_SECONDS,
  XP_RANK_TIERS,
  XP_REWARDS_CONFIG,
} from '@/src/services/xpService';
import type { XpActionType } from '@/src/types/anime';

export const UserLevelBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { levelInfo } = useAuth();
  const tier = getLevelTier(levelInfo.level);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-sm ${className}`}
      style={{
        borderColor: `${tier.accentHex}70`,
        background: `linear-gradient(135deg, ${tier.accentHex}24 0%, ${tier.secondaryHex}14 100%)`,
        color: tier.secondaryHex,
        boxShadow: `0 0 18px -6px ${tier.accentHex}90`,
      }}
    >
      {levelInfo.isUnlimitedAdmin ? (
        <Crown className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Zap className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="tabular-nums">
        {levelInfo.isUnlimitedAdmin
          ? `Lv ${levelInfo.level}+ · ${levelInfo.title} · ∞ XP`
          : `Lv ${levelInfo.level} · ${levelInfo.title}`}
      </span>
    </span>
  );
};

function getXpActionLabel(action: XpActionType): string {
  switch (action) {
    case 'first_episode':
      return 'First Episode';
    case 'episode_complete':
      return 'Episode Completed';
    case 'daily_goal':
      return 'Daily Watch Goal';
    case 'daily_login':
      return 'Daily Login';
    case 'streak_milestone':
      return 'Streak Milestone';
    default:
      return 'XP Reward';
  }
}

export const UserLevelXpSection: React.FC = () => {
  const { levelInfo, xpHistory, watchStats } = useAuth();
  const tier = getLevelTier(levelInfo.level);
  const todaySeconds = Math.max(0, watchStats.todayWatchSeconds || 0);
  const goalPct = Math.min(100, Math.round((todaySeconds / XP_DAILY_GOAL_SECONDS) * 100));
  const goalMinutesDone = Math.floor(todaySeconds / 60);
  const goalMinutesTarget = Math.round(XP_DAILY_GOAL_SECONDS / 60);

  return (
    <section
      className="kuro-glass relative overflow-hidden rounded-3xl border p-5 sm:p-6 space-y-5"
      style={{
        borderColor: `${tier.accentHex}55`,
        boxShadow: `0 0 42px -14px ${tier.accentHex}50`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-25"
        style={{ background: tier.accentHex }}
      />

      {/* Top Level & XP Header */}
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border shadow-lg"
            style={{
              borderColor: `${tier.secondaryHex}99`,
              background: `linear-gradient(155deg, ${tier.accentHex}35 0%, rgba(10,12,22,0.96) 80%)`,
              boxShadow: `0 0 24px -6px ${tier.accentHex}`,
            }}
          >
            {levelInfo.isUnlimitedAdmin ? (
              <Crown className="h-6 w-6 text-cyan-300" />
            ) : (
              <>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">
                  LVL
                </span>
                <span className="text-xl font-black leading-none text-white tabular-nums">
                  {levelInfo.level}
                </span>
              </>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {levelInfo.title}
              </h2>
              {levelInfo.isUnlimitedAdmin && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                  <ShieldCheck className="h-3 w-3" />
                  Admin Elite Showcase
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
              {levelInfo.isUnlimitedAdmin ? (
                <span className="inline-flex items-center gap-1.5 text-cyan-300 font-semibold">
                  <InfinityIcon className="h-3.5 w-3.5" />
                  Unlimited Admin XP · Max Rank Unlocked
                </span>
              ) : (
                <>
                  Total Earned:{' '}
                  <span className="font-bold text-white">
                    {levelInfo.totalXp.toLocaleString()} XP
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Daily Watch Goal Pill */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#080a14]/85 px-4 py-2.5 min-w-[200px]">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span className="text-slate-300">Daily Watch Goal</span>
            <span className="text-emerald-300 tabular-nums">
              {goalMinutesDone}/{goalMinutesTarget} min
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700"
              style={{ width: `${Math.max(4, goalPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Animated Level XP Progress Bar */}
      <div className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#080a14]/85 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold tabular-nums">
          <span className="text-slate-200">
            {levelInfo.isUnlimitedAdmin
              ? 'Level 50+ Flix4U Elite Progress'
              : `Level ${levelInfo.level} → Level ${Math.min(99, levelInfo.level + 1)}`}
          </span>
          <span style={{ color: tier.secondaryHex }}>
            {levelInfo.isUnlimitedAdmin
              ? '∞ / ∞ XP (100%)'
              : `${levelInfo.xpIntoLevel.toLocaleString()} / ${levelInfo.xpNeededForNext.toLocaleString()} XP (${levelInfo.progressPercent}%)`}
          </span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.08] p-0.5">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.max(4, levelInfo.progressPercent)}%`,
              background: `linear-gradient(90deg, ${tier.accentHex}, ${tier.secondaryHex})`,
              boxShadow: `0 0 14px ${tier.accentHex}`,
            }}
          />
        </div>

        {!levelInfo.isUnlimitedAdmin && levelInfo.level < 99 && (
          <p className="text-[11px] text-slate-400 tabular-nums">
            {Math.max(0, levelInfo.xpNeededForNext - levelInfo.xpIntoLevel).toLocaleString()} XP needed to reach{' '}
            <span className="font-semibold text-white">Level {levelInfo.level + 1}</span>
          </p>
        )}
      </div>

      {/* Rank Tier Roadmap */}
      <div className="relative z-10 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Rank Progression Tiers
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {XP_RANK_TIERS.map((rankTier) => {
            const reached = levelInfo.level >= rankTier.minLevel || Boolean(levelInfo.isUnlimitedAdmin);
            return (
              <div
                key={rankTier.title}
                className={`rounded-2xl border px-3 py-2.5 transition-colors ${
                  reached
                    ? 'bg-white/[0.05] text-white'
                    : 'border-white/[0.06] bg-[#080a13]/70 text-slate-500'
                }`}
                style={
                  reached
                    ? {
                        borderColor: `${rankTier.accentHex}70`,
                        boxShadow: `0 0 16px -8px ${rankTier.accentHex}`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-bold tabular-nums">
                  <span style={reached ? { color: rankTier.secondaryHex } : undefined}>
                    {rankTier.badgeText}
                  </span>
                  {reached && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                </div>
                <p className="mt-1 truncate text-xs font-bold">{rankTier.title}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* How to Earn XP & Recent Verified History */}
      <div className="relative z-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#080a14]/80 p-4 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Verified XP Rules</span>
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300 tabular-nums">
            <li className="flex items-center justify-between">
              <span>First completed episode</span>
              <span className="font-bold text-amber-300">+{XP_REWARDS_CONFIG.first_episode} XP</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Each new episode completed</span>
              <span className="font-bold text-violet-300">+{XP_REWARDS_CONFIG.episode_complete} XP</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Daily watch goal (15+ min)</span>
              <span className="font-bold text-emerald-300">+{XP_REWARDS_CONFIG.daily_goal} XP</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Daily login check-in</span>
              <span className="font-bold text-cyan-300">+{XP_REWARDS_CONFIG.daily_login} XP</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Streak milestones (3d / 7d / 15d / 30d / 100d)</span>
              <span className="font-bold text-fuchsia-300">+25 to +500 XP</span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#080a14]/80 p-4 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" />
            <span>Recent XP History</span>
          </h3>
          {levelInfo.isUnlimitedAdmin && xpHistory.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">
              Admin Elite accounts permanently showcase Level 50+ Flix4U Elite with unlimited XP.
            </p>
          ) : xpHistory.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">
              Complete an anime episode or reach 15 minutes of watch time today to start earning verified XP!
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {xpHistory.slice(0, 12).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {entry.animeTitle
                        ? `${entry.animeTitle}${entry.episodeNumber ? ` · Ep ${entry.episodeNumber}` : ''}`
                        : entry.reason || getXpActionLabel(entry.actionType)}
                    </p>
                    <p className="text-[10px] text-slate-400 tabular-nums">
                      {getXpActionLabel(entry.actionType)} ·{' '}
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300 tabular-nums">
                    +{entry.xpDelta} XP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export const LevelUpModal: React.FC = () => {
  const { levelUpEvent, dismissLevelUp } = useAuth();
  if (!levelUpEvent) return null;

  const tier = getLevelTier(levelUpEvent.toLevel);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) dismissLevelUp();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Level Up Celebration"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border bg-[#0c0e1a] p-6 text-center shadow-2xl"
        style={{
          borderColor: `${tier.accentHex}88`,
          boxShadow: `0 0 60px -10px ${tier.accentHex}99`,
        }}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border"
          style={{
            borderColor: `${tier.secondaryHex}99`,
            background: `linear-gradient(145deg, ${tier.accentHex}35, rgba(12,14,26,0.95))`,
          }}
        >
          <Trophy className="h-8 w-8" style={{ color: tier.secondaryHex }} />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-200">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>Level Up!</span>
        </div>

        <h2 className="mt-2 text-2xl font-black text-white tabular-nums">
          Level {levelUpEvent.toLevel}
        </h2>
        <p className="mt-0.5 text-sm font-bold" style={{ color: tier.secondaryHex }}>
          {levelUpEvent.title}
        </p>

        <p className="mt-3 text-xs text-slate-300">
          {levelUpEvent.reason} (+{levelUpEvent.xpGained} XP)
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 tabular-nums">
          <span>Lv {levelUpEvent.fromLevel}</span>
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-bold text-white">Lv {levelUpEvent.toLevel}</span>
        </div>

        <button
          type="button"
          onClick={dismissLevelUp}
          className="kuro-btn-primary mt-6 min-h-[42px] w-full rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
};
