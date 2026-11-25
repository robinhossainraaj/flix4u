import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Info,
  Trophy,
} from 'lucide-react';
import {
  computeStreakMilestones,
  formatLocalDateKey,
  formatWatchDuration,
  getEffectiveCurrentStreak,
  getTodayDateKey,
  getTotalWatchedDaysCount,
} from '@/src/services/achievementService';
import type { UserWatchStats } from '@/src/types/anime';

interface StreakCalendarSectionProps {
  stats: UserWatchStats;
  isAdmin?: boolean;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarCell {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  watchedSeconds: number;
  isWatched: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export const StreakCalendarSection: React.FC<StreakCalendarSectionProps> = ({
  stats,
  isAdmin = false,
}) => {
  const todayKey = getTodayDateKey();
  const now = useMemo(() => new Date(), []);

  const [viewYear, setViewYear] = useState<number>(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => now.getMonth()); // 0-indexed
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const watchedDaysSet = useMemo(() => {
    const set = new Set<string>(stats.streakWatchedDays || []);
    for (const [k, secs] of Object.entries(stats.dailyWatchSeconds || {})) {
      if (secs > 0) set.add(k);
    }
    return set;
  }, [stats.streakWatchedDays, stats.dailyWatchSeconds]);

  const currentStreak = getEffectiveCurrentStreak(stats);
  const longestStreak = Math.max(stats.streakLongest || 0, currentStreak);
  const totalWatchDays = getTotalWatchedDaysCount(stats);
  const isWatchedToday =
    watchedDaysSet.has(todayKey) &&
    ((stats.dailyWatchSeconds?.[todayKey] || 0) >= 60 ||
      (stats.streakWatchedDays || []).includes(todayKey));

  const milestones = useMemo(
    () => computeStreakMilestones(currentStreak, isAdmin),
    [currentStreak, isAdmin]
  );

  const monthLabel = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [viewYear, viewMonth]);

  const isViewingCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDateKey(todayKey);
  };

  const { cells, monthWatchedDays, monthTotalSeconds } = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalGridSlots = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    const gridCells: CalendarCell[] = [];
    let watchedCount = 0;
    let totalSecs = 0;

    for (let slot = 0; slot < totalGridSlots; slot++) {
      const dayOffset = slot - startWeekday + 1;
      const cellDate = new Date(viewYear, viewMonth, dayOffset);
      const inCurrentMonth =
        cellDate.getFullYear() === viewYear && cellDate.getMonth() === viewMonth;
      const dateKey = formatLocalDateKey(cellDate);
      const secs = Math.max(0, Math.round(stats.dailyWatchSeconds?.[dateKey] || 0));
      const inLegacyList = (stats.streakWatchedDays || []).includes(dateKey);
      const isWatched = secs > 0 || inLegacyList;
      const isFuture = dateKey > todayKey;

      if (inCurrentMonth && isWatched) {
        watchedCount += 1;
        totalSecs += secs;
      }

      gridCells.push({
        dateKey,
        dayNumber: cellDate.getDate(),
        inCurrentMonth,
        watchedSeconds: secs,
        isWatched,
        isToday: dateKey === todayKey,
        isFuture,
      });
    }

    return {
      cells: gridCells,
      monthWatchedDays: watchedCount,
      monthTotalSeconds: totalSecs,
    };
  }, [viewYear, viewMonth, stats.dailyWatchSeconds, stats.streakWatchedDays, todayKey]);

  const selectedDayInfo = useMemo(() => {
    const secs = Math.max(0, Math.round(stats.dailyWatchSeconds?.[selectedDateKey] || 0));
    const inLegacyList = (stats.streakWatchedDays || []).includes(selectedDateKey);
    const hasActivity = secs > 0 || inLegacyList;
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const dateObj =
      y && m && d ? new Date(y, m - 1, d) : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return {
      formattedDate,
      secs,
      hasActivity,
      inLegacyList,
    };
  }, [selectedDateKey, stats.dailyWatchSeconds, stats.streakWatchedDays]);

  return (
    <div className="space-y-6">
      {/* Watch Streak & Summary Hero */}
      <div className="kuro-glass relative overflow-hidden rounded-3xl border border-violet-500/25 p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-violet-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -bottom-12 h-44 w-44 rounded-full bg-fuchsia-600/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 sm:items-center">
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl border border-violet-400/45 bg-gradient-to-br from-violet-500/30 to-fuchsia-600/20 shadow-[0_0_24px_rgba(139,92,246,0.35)]">
              <Flame className="h-8 w-8 sm:h-9 sm:w-9 text-violet-300" />
              {isWatchedToday && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums">
                  {currentStreak} Day <span className="text-violet-400">Streak</span>
                </h2>
                <span
                  className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-bold ${
                    isWatchedToday
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-violet-400/35 bg-violet-500/15 text-violet-200'
                  }`}
                >
                  {isWatchedToday ? 'Active Today' : 'Watch 1 min today'}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                {isWatchedToday
                  ? "Daily activity recorded. Keep streaming to extend your purple neon streak!"
                  : 'Watch an anime episode today to light up your calendar and grow your streak.'}
              </p>
            </div>
          </div>

          {/* 4-Stat Metric Strip */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:shrink-0">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0b0d17]/90 px-3.5 py-2.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Watch Streak
              </span>
              <span className="mt-0.5 block text-lg font-black text-violet-300 tabular-nums">
                {currentStreak} <span className="text-xs font-semibold text-slate-400">Days</span>
              </span>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0b0d17]/90 px-3.5 py-2.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Longest Streak
              </span>
              <span className="mt-0.5 block text-lg font-black text-amber-300 tabular-nums">
                {longestStreak} <span className="text-xs font-semibold text-slate-400">Days</span>
              </span>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0b0d17]/90 px-3.5 py-2.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Watch Days
              </span>
              <span className="mt-0.5 block text-lg font-black text-fuchsia-300 tabular-nums">
                {totalWatchDays} <span className="text-xs font-semibold text-slate-400">Days</span>
              </span>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0b0d17]/90 px-3.5 py-2.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Watch Time
              </span>
              <span className="mt-0.5 block text-lg font-black text-white tabular-nums">
                {formatWatchDuration(stats.totalWatchSeconds || 0, 'compact')}
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-[11px] text-slate-400">
          <Info className="h-3.5 w-3.5 shrink-0 text-violet-400" />
          <span>
            Only verified active video playback counts toward your daily watch time, streak, and calendar activity.
          </span>
        </div>
      </div>

      {/* Monthly Daily Watch Activity Calendar */}
      <div className="kuro-glass rounded-3xl border border-violet-500/25 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/20 text-violet-300 shadow-[0_0_16px_rgba(139,92,246,0.3)]">
              <CalendarIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Daily Watch Activity Calendar
              </h3>
              <p className="text-xs text-slate-400 tabular-nums">
                {monthWatchedDays} watched {monthWatchedDays === 1 ? 'day' : 'days'} ·{' '}
                {formatWatchDuration(monthTotalSeconds, 'long')} in {monthLabel}
              </p>
            </div>
          </div>

          {/* Month Navigation Controls */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!isViewingCurrentMonth && (
              <button
                type="button"
                onClick={handleJumpToday}
                className="kuro-btn-glass min-h-[44px] rounded-xl px-3 text-xs font-semibold text-violet-300"
              >
                Today
              </button>
            )}
            <div className="inline-flex items-center gap-1 rounded-2xl border border-white/[0.1] bg-[#0a0c15] p-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-violet-500/20 hover:text-white"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              <span className="min-w-[132px] px-2 text-center text-xs sm:text-sm font-bold text-white">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-violet-500/20 hover:text-white"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 text-center">
          {WEEKDAY_HEADERS.map((day) => (
            <div
              key={day}
              className="py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Monthly Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {cells.map((cell) => {
            const isSelected = cell.dateKey === selectedDateKey;
            const mins = Math.floor(cell.watchedSeconds / 60);

            // Purple neon activity tier classes
            let activityClass =
              'border-white/[0.06] bg-[#0b0d17]/75 text-slate-400 hover:border-violet-500/40';
            if (!cell.inCurrentMonth) {
              activityClass =
                'border-white/[0.03] bg-[#080910]/45 text-slate-600 opacity-50';
            } else if (cell.isWatched) {
              if (mins >= 60) {
                activityClass =
                  'border-fuchsia-400/80 bg-gradient-to-b from-violet-500/35 to-fuchsia-600/25 text-white shadow-[0_0_20px_-4px_rgba(192,38,211,0.65)]';
              } else if (mins >= 15) {
                activityClass =
                  'border-violet-400/75 bg-gradient-to-b from-violet-600/30 to-purple-900/30 text-white shadow-[0_0_14px_-4px_rgba(139,92,246,0.55)]';
              } else {
                activityClass =
                  'border-violet-500/50 bg-violet-600/15 text-violet-100 shadow-[0_0_10px_-4px_rgba(139,92,246,0.4)]';
              }
            } else if (cell.isFuture) {
              activityClass =
                'border-dashed border-white/[0.07] bg-transparent text-slate-600';
            }

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => {
                  setSelectedDateKey(cell.dateKey);
                  if (!cell.inCurrentMonth) {
                    const [cy, cm] = cell.dateKey.split('-').map(Number);
                    if (cy && cm) {
                      setViewYear(cy);
                      setViewMonth(cm - 1);
                    }
                  }
                }}
                aria-label={`${cell.dateKey}: ${
                  cell.isWatched
                    ? `${formatWatchDuration(cell.watchedSeconds, 'long')} watched`
                    : 'No watch activity'
                }`}
                className={`relative flex min-h-[52px] sm:min-h-[68px] flex-col items-center justify-between rounded-2xl border p-1.5 sm:p-2 transition-all duration-200 ${activityClass} ${
                  isSelected
                    ? 'ring-2 ring-purple-300 ring-offset-2 ring-offset-[#07080d]'
                    : cell.isToday
                      ? 'ring-1 ring-violet-400/80'
                      : ''
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                      cell.isToday ? 'text-violet-200' : ''
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  {cell.inCurrentMonth && cell.isWatched && (
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${
                        mins >= 60
                          ? 'bg-fuchsia-400 shadow-[0_0_8px_#e879f9]'
                          : 'bg-violet-400 shadow-[0_0_8px_#a78bfa]'
                      }`}
                    />
                  )}
                </div>

                {cell.inCurrentMonth && cell.isWatched ? (
                  <span className="mt-1 truncate max-w-full rounded-md bg-black/35 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-violet-200 tabular-nums">
                    {cell.watchedSeconds > 0
                      ? formatWatchDuration(cell.watchedSeconds, 'compact')
                      : 'Active'}
                  </span>
                ) : cell.isToday && cell.inCurrentMonth ? (
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-tight text-violet-300">
                    Today
                  </span>
                ) : (
                  <span className="h-3" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Watch Time Inspector + Legend */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0a0c16]/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                selectedDayInfo.hasActivity
                  ? 'border-violet-400/50 bg-violet-500/20 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.35)]'
                  : 'border-white/10 bg-white/[0.04] text-slate-400'
              }`}
            >
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">{selectedDayInfo.formattedDate}</p>
              <p className="text-xs text-slate-300 tabular-nums">
                {selectedDayInfo.secs > 0
                  ? `Daily watch time: ${formatWatchDuration(selectedDayInfo.secs, 'long')}`
                  : selectedDayInfo.inLegacyList
                    ? 'Watch activity logged on this date'
                    : 'No watch activity logged on this date'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-white/20 bg-white/5" />
              <span>Rest</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-violet-500/60 bg-violet-600/25" />
              <span>1–14m</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-violet-400 bg-violet-500/50 shadow-[0_0_6px_rgba(139,92,246,0.7)]" />
              <span>15m+</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-fuchsia-400 bg-fuchsia-500/60 shadow-[0_0_8px_rgba(217,70,239,0.85)]" />
              <span>1h+</span>
            </span>
          </div>
        </div>
      </div>

      {/* Streak Milestones Roadmap */}
      <div className="kuro-glass rounded-3xl border border-white/[0.1] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-400" />
          <h3 className="text-base font-bold text-white">Streak Milestones Roadmap</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {milestones.map((m) => {
            const daysLeft = Math.max(0, m.days - currentStreak);
            return (
              <div
                key={m.days}
                className={`flex flex-col justify-between rounded-2xl p-4 transition-all ${
                  m.unlocked
                    ? 'border border-violet-400/50 bg-gradient-to-b from-violet-500/15 to-purple-950/25 shadow-[0_0_18px_-6px_rgba(139,92,246,0.4)]'
                    : 'border border-white/[0.08] bg-[#0c0e18]/70 opacity-85'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-300 tabular-nums">
                      {m.days} Days
                    </span>
                    {m.unlocked ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                        {daysLeft} left
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-white">{m.title}</h4>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-300">{m.rewardBadge}</p>
                </div>

                <div className="mt-3 border-t border-white/[0.08] pt-2">
                  <span
                    className={`inline-block text-[10px] font-semibold ${
                      m.unlocked ? 'font-bold text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {m.unlocked ? 'Milestone Unlocked' : `Reach day ${m.days}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
