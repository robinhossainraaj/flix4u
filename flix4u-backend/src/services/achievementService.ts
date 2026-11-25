import type {
  AchievementBadge,
  AchievementId,
  StreakMilestone,
  UserWatchStats,
} from '@/src/types/anime';

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  {
    id: 'first_watch',
    emoji: '🌟',
    title: 'First Watch',
    description: 'Watch your first anime episode or stream at least 1 minute on Flix4U.',
    targetCount: 1,
    unitLabel: 'Watch',
    metricType: 'first_watch',
    tier: 'bronze',
    accentHex: '#f59e0b',
    secondaryHex: '#fde047',
    badgeLabel: 'First Session',
  },
  {
    id: 'streak_3',
    emoji: '🔥',
    title: '3 Days Streak',
    description: 'Keep watching anime for 3 consecutive calendar days.',
    targetCount: 3,
    unitLabel: 'Days',
    metricType: 'streak',
    tier: 'bronze',
    accentHex: '#f97316',
    secondaryHex: '#fb923c',
    badgeLabel: '3-Day Flame',
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    title: '7 Days Streak',
    description: 'Maintain an unbroken 7-day anime watch streak.',
    targetCount: 7,
    unitLabel: 'Days',
    metricType: 'streak',
    tier: 'silver',
    accentHex: '#ef4444',
    secondaryHex: '#f97316',
    badgeLabel: '7-Day Blaze',
  },
  {
    id: 'streak_30',
    emoji: '👑',
    title: '30 Days Streak',
    description: 'Stay dedicated for a full 30-day consecutive anime streak.',
    targetCount: 30,
    unitLabel: 'Days',
    metricType: 'streak',
    tier: 'gold',
    accentHex: '#eab308',
    secondaryHex: '#fef08a',
    badgeLabel: '30-Day Crown',
  },
  {
    id: 'streak_100',
    emoji: '💎',
    title: '100 Days Streak',
    description: 'Achieve an extraordinary 100-day continuous watch streak.',
    targetCount: 100,
    unitLabel: 'Days',
    metricType: 'streak',
    tier: 'diamond',
    accentHex: '#22d3ee',
    secondaryHex: '#a5f3fc',
    badgeLabel: '100-Day Diamond',
  },
  {
    id: 'anime_explorer',
    emoji: '🍥',
    title: 'Anime Explorer',
    description: 'Explore and watch 5 different anime series across Flix4U.',
    targetCount: 5,
    unitLabel: 'Series',
    metricType: 'unique_anime',
    tier: 'purple',
    accentHex: '#ec4899',
    secondaryHex: '#a855f7',
    badgeLabel: '5 Unique Series',
  },
  {
    id: 'anime_master',
    emoji: '⚔️',
    title: 'Anime Master',
    description: 'Complete 50 anime episodes across your watch journey.',
    targetCount: 50,
    unitLabel: 'Eps',
    metricType: 'episodes',
    tier: 'silver',
    accentHex: '#8b5cf6',
    secondaryHex: '#c084fc',
    badgeLabel: '50 Episodes',
  },
  {
    id: 'anime_legend',
    emoji: '🏆',
    title: 'Anime Legend',
    description: 'Complete 250 anime episodes and claim legendary viewer status.',
    targetCount: 250,
    unitLabel: 'Eps',
    metricType: 'episodes',
    tier: 'gold',
    accentHex: '#facc15',
    secondaryHex: '#fb923c',
    badgeLabel: '250 Episodes',
  },
  {
    id: 'binge_watcher',
    emoji: '🎬',
    title: 'Binge Watcher',
    description: 'Watch 5 episodes or 2 full hours of anime within a single day.',
    targetCount: 5,
    unitLabel: 'Eps/Day',
    metricType: 'daily_binge',
    tier: 'purple',
    accentHex: '#d946ef',
    secondaryHex: '#9333ea',
    badgeLabel: 'Daily Binge',
  },
  {
    id: 'marathon_legend',
    emoji: '🚀',
    title: 'Marathon Legend',
    description: 'Accumulate 50 hours of verified video playback time on Flix4U.',
    targetCount: 50,
    unitLabel: 'Hrs',
    metricType: 'watch_hours',
    tier: 'diamond',
    accentHex: '#6366f1',
    secondaryHex: '#38bdf8',
    badgeLabel: '50 Hours Watched',
  },
];

export const STREAK_MILESTONES_CONFIG: Array<{ days: number; title: string; rewardBadge: string }> = [
  { days: 3, title: '3-Day Streak', rewardBadge: '🔥 3 Days Streak' },
  { days: 7, title: '7-Day Streak', rewardBadge: '🔥 7 Days Streak' },
  { days: 15, title: '15-Day Streak', rewardBadge: 'Half-Month Spirit' },
  { days: 30, title: '30-Day Streak', rewardBadge: '👑 30 Days Streak' },
  { days: 100, title: '100-Day Streak', rewardBadge: '💎 100 Days Streak' },
];

export const WATCH_STATS_STORAGE_KEY = 'flix4u_watch_stats_v3';
export const COMPLETED_EPS_STORAGE_KEY = 'flix4u_completed_episodes_v3';
export const MAX_EQUIPPED_BADGES = 5;

export const ADMIN_PERMANENT_UNLOCK_LABEL = 'Permanent Admin Unlock';

const LEGACY_BADGE_MAP: Record<string, AchievementId> = {
  first_episode: 'first_watch',
  master: 'anime_master',
  legendary: 'anime_legend',
  binge_watcher: 'binge_watcher',
};

export const DEFAULT_WATCH_STATS: UserWatchStats = {
  streakCurrent: 0,
  streakLongest: 0,
  streakWatchedDays: [],
  totalEpisodesCompleted: 0,
  todayEpisodesCompleted: 0,
  totalWatchSeconds: 0,
  todayWatchSeconds: 0,
  watchedAnimeIds: [],
  dailyWatchSeconds: {},
  unlockedAchievements: [],
  achievementUnlockDates: {},
  equippedFrame: 'none',
  checkinStreak: 0,
  totalCheckins: 0,
  coins: 0,
};

export function formatLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateKey(): string {
  return formatLocalDateKey(new Date());
}

export function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDateKey(d);
}

// Preserved alias exports for compatibility across modules
export const getTodayUtcKey = getTodayDateKey;
export const getYesterdayUtcKey = getYesterdayDateKey;

export function getMonthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function normalizeAchievementList(
  rawIds: unknown,
  rawUnlockDates?: unknown
): { unlockedAchievements: string[]; achievementUnlockDates: Record<string, string> } {
  const validIds = new Set<string>(ACHIEVEMENT_BADGES.map((b) => b.id));
  const unlockedSet = new Set<string>();
  const unlockDates: Record<string, string> = {};

  if (rawUnlockDates && typeof rawUnlockDates === 'object' && !Array.isArray(rawUnlockDates)) {
    for (const [key, val] of Object.entries(rawUnlockDates as Record<string, unknown>)) {
      const mapped = LEGACY_BADGE_MAP[key] || (validIds.has(key) ? (key as AchievementId) : null);
      if (mapped && typeof val === 'string' && val.trim()) {
        unlockDates[mapped] = val.trim().slice(0, 40);
      }
    }
  }

  if (Array.isArray(rawIds)) {
    for (const item of rawIds) {
      if (typeof item !== 'string') continue;
      const mapped = LEGACY_BADGE_MAP[item] || (validIds.has(item) ? (item as AchievementId) : null);
      if (mapped) {
        unlockedSet.add(mapped);
      }
    }
  }

  return {
    unlockedAchievements: Array.from(unlockedSet),
    achievementUnlockDates: unlockDates,
  };
}

function getScopedStorageKey(baseKey: string, uid?: string): string {
  return uid ? `${baseKey}:${uid}` : baseKey;
}

export function getStoredWatchStats(uid?: string): UserWatchStats {
  if (typeof window === 'undefined') return DEFAULT_WATCH_STATS;
  try {
    const raw = localStorage.getItem(getScopedStorageKey(WATCH_STATS_STORAGE_KEY, uid));
    if (!raw) return DEFAULT_WATCH_STATS;
    const parsed = JSON.parse(raw) as Partial<UserWatchStats>;
    const today = getTodayDateKey();
    const isEpToday = parsed.todayCompletedDate === today;
    const isWatchToday = parsed.todayWatchDate === today;
    const { unlockedAchievements, achievementUnlockDates } = normalizeAchievementList(
      parsed.unlockedAchievements,
      parsed.achievementUnlockDates
    );

    return {
      theme: parsed.theme,
      streakCurrent:
        typeof parsed.streakCurrent === 'number' && parsed.streakCurrent >= 0
          ? parsed.streakCurrent
          : 0,
      streakLongest:
        typeof parsed.streakLongest === 'number' && parsed.streakLongest >= 0
          ? parsed.streakLongest
          : 0,
      streakLastWatchedDate:
        typeof parsed.streakLastWatchedDate === 'string' ? parsed.streakLastWatchedDate : undefined,
      streakWatchedDays: Array.isArray(parsed.streakWatchedDays)
        ? parsed.streakWatchedDays.filter((d): d is string => typeof d === 'string')
        : [],
      totalEpisodesCompleted:
        typeof parsed.totalEpisodesCompleted === 'number' && parsed.totalEpisodesCompleted >= 0
          ? parsed.totalEpisodesCompleted
          : 0,
      todayEpisodesCompleted:
        isEpToday && typeof parsed.todayEpisodesCompleted === 'number'
          ? parsed.todayEpisodesCompleted
          : 0,
      todayCompletedDate: today,
      totalWatchSeconds:
        typeof parsed.totalWatchSeconds === 'number' && parsed.totalWatchSeconds >= 0
          ? parsed.totalWatchSeconds
          : 0,
      todayWatchSeconds:
        isWatchToday && typeof parsed.todayWatchSeconds === 'number'
          ? parsed.todayWatchSeconds
          : 0,
      todayWatchDate: today,
      watchedAnimeIds: Array.isArray(parsed.watchedAnimeIds)
        ? parsed.watchedAnimeIds.filter((id): id is string => typeof id === 'string')
        : [],
      dailyWatchSeconds:
        parsed.dailyWatchSeconds && typeof parsed.dailyWatchSeconds === 'object'
          ? parsed.dailyWatchSeconds
          : {},
      unlockedAchievements,
      achievementUnlockDates,
    };
  } catch {
    return DEFAULT_WATCH_STATS;
  }
}

export function saveStoredWatchStats(stats: UserWatchStats, uid?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getScopedStorageKey(WATCH_STATS_STORAGE_KEY, uid), JSON.stringify(stats));
  } catch {
    // ignore local storage errors
  }
}

function getStoredCompletedEpisodeKeys(uid?: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(getScopedStorageKey(COMPLETED_EPS_STORAGE_KEY, uid));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveCompletedEpisodeKeys(keys: Set<string>, uid?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(keys).slice(-500);
    localStorage.setItem(getScopedStorageKey(COMPLETED_EPS_STORAGE_KEY, uid), JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function getEffectiveCurrentStreak(stats: UserWatchStats): number {
  const last = stats.streakLastWatchedDate;
  if (!last) return 0;
  const today = getTodayDateKey();
  const yesterday = getYesterdayDateKey();
  if (last === today || last === yesterday) {
    return stats.streakCurrent || 0;
  }
  return 0;
}

export function getTotalWatchedDaysCount(stats: UserWatchStats): number {
  const days = new Set<string>(stats.streakWatchedDays || []);
  for (const [dateKey, secs] of Object.entries(stats.dailyWatchSeconds || {})) {
    if (secs >= 60) {
      days.add(dateKey);
    }
  }
  return days.size;
}

export function formatWatchDuration(totalSeconds: number, style: 'compact' | 'long' = 'compact'): string {
  const secs = Math.max(0, Math.floor(totalSeconds || 0));
  if (secs === 0) {
    return style === 'long' ? '0 mins' : '0m';
  }
  if (secs < 60) {
    return style === 'long' ? `${secs} secs` : `${secs}s`;
  }
  const totalMins = Math.floor(secs / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (style === 'long') {
    if (hours > 0) {
      return mins > 0 ? `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}` : `${hours} hr${hours > 1 ? 's' : ''}`;
    }
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  }

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function formatUnlockDate(value?: string): string {
  if (!value) return '';
  if (value === ADMIN_PERMANENT_UNLOCK_LABEL) return ADMIN_PERMANENT_UNLOCK_LABEL;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function evaluateBadgeUnlock(badge: AchievementBadge, stats: UserWatchStats): boolean {
  const bestStreak = Math.max(
    stats.streakCurrent || 0,
    stats.streakLongest || 0,
    getEffectiveCurrentStreak(stats)
  );
  const todayKey = getTodayDateKey();
  const todayEps = stats.todayCompletedDate === todayKey ? stats.todayEpisodesCompleted || 0 : 0;
  const todaySecs =
    stats.todayWatchDate === todayKey
      ? stats.todayWatchSeconds || 0
      : stats.dailyWatchSeconds?.[todayKey] || 0;

  switch (badge.id) {
    case 'first_watch':
      return (stats.totalEpisodesCompleted || 0) >= 1 || (stats.totalWatchSeconds || 0) >= 60;
    case 'streak_3':
      return bestStreak >= 3;
    case 'streak_7':
      return bestStreak >= 7;
    case 'streak_30':
      return bestStreak >= 30;
    case 'streak_100':
      return bestStreak >= 100;
    case 'anime_explorer':
      return (stats.watchedAnimeIds || []).length >= 5;
    case 'anime_master':
      return (stats.totalEpisodesCompleted || 0) >= 50;
    case 'anime_legend':
      return (stats.totalEpisodesCompleted || 0) >= 250;
    case 'binge_watcher':
      return todayEps >= 5 || todaySecs >= 7200;
    case 'marathon_legend':
      return (stats.totalWatchSeconds || 0) >= 50 * 3600;
    default:
      return false;
  }
}

function applyDailyStreakForDate(stats: UserWatchStats, dateKey: string): void {
  const yesterday = getYesterdayDateKey();
  if (stats.streakLastWatchedDate !== dateKey) {
    if (stats.streakLastWatchedDate === yesterday) {
      stats.streakCurrent = (stats.streakCurrent || 0) + 1;
    } else {
      stats.streakCurrent = 1;
    }
    stats.streakLastWatchedDate = dateKey;
  } else if ((stats.streakCurrent || 0) === 0) {
    stats.streakCurrent = 1;
  }

  stats.streakLongest = Math.max(stats.streakLongest || 0, stats.streakCurrent || 0);

  const watchedDaysSet = new Set(stats.streakWatchedDays || []);
  watchedDaysSet.add(dateKey);
  stats.streakWatchedDays = Array.from(watchedDaysSet).sort().slice(-390);
}

function evaluateAllBadges(stats: UserWatchStats): AchievementBadge[] {
  const normalized = normalizeAchievementList(
    stats.unlockedAchievements,
    stats.achievementUnlockDates
  );
  const currentlyUnlocked = new Set<string>(normalized.unlockedAchievements);
  const unlockDates: Record<string, string> = { ...normalized.achievementUnlockDates };
  const newlyUnlocked: AchievementBadge[] = [];
  const nowIso = new Date().toISOString();

  for (const badge of ACHIEVEMENT_BADGES) {
    if (currentlyUnlocked.has(badge.id)) {
      if (!unlockDates[badge.id]) {
        unlockDates[badge.id] = nowIso;
      }
      continue;
    }

    if (evaluateBadgeUnlock(badge, stats)) {
      currentlyUnlocked.add(badge.id);
      unlockDates[badge.id] = nowIso;
      newlyUnlocked.push(badge);
    }
  }

  stats.unlockedAchievements = Array.from(currentlyUnlocked);
  stats.achievementUnlockDates = unlockDates;
  return newlyUnlocked;
}

export interface PlaybackRecordInput {
  animeKey: string;
  animeId: number;
  episodeNumber: number;
  episodeKey?: string;
  secondsWatched: number;
  completed?: boolean;
  sessionLogId?: string;
  animeTitle?: string;
  coverImage?: string;
  episodeTitle?: string;
  serverName?: string;
  audioMode?: 'sub' | 'dub' | 'hindi';
  progressSeconds?: number;
  durationSeconds?: number;
}

export interface RecordPlaybackResult {
  stats: UserWatchStats;
  newlyUnlocked: AchievementBadge[];
  monthKey: string;
  todayKey: string;
  todayDaySeconds: number;
  safeDelta: number;
  changed: boolean;
}

export function recordWatchPlaybackLocally(
  input: PlaybackRecordInput,
  currentStats?: UserWatchStats,
  uid?: string
): RecordPlaybackResult {
  const base = currentStats ? { ...currentStats } : { ...getStoredWatchStats(uid) };
  const today = getTodayDateKey();
  const monthKey = getMonthKeyFromDateKey(today);

  const stats: UserWatchStats = {
    ...base,
    streakWatchedDays: [...(base.streakWatchedDays || [])],
    watchedAnimeIds: [...(base.watchedAnimeIds || [])],
    dailyWatchSeconds: { ...(base.dailyWatchSeconds || {}) },
    unlockedAchievements: [...(base.unlockedAchievements || [])],
    achievementUnlockDates: { ...(base.achievementUnlockDates || {}) },
  };

  const safeDelta = Math.max(0, Math.min(300, Math.round(input.secondsWatched || 0)));
  let changed = false;

  if (safeDelta > 0) {
    stats.totalWatchSeconds = (stats.totalWatchSeconds || 0) + safeDelta;
    if (stats.todayWatchDate === today) {
      stats.todayWatchSeconds = (stats.todayWatchSeconds || 0) + safeDelta;
    } else {
      stats.todayWatchDate = today;
      stats.todayWatchSeconds = (stats.dailyWatchSeconds[today] || 0) + safeDelta;
    }
    stats.dailyWatchSeconds[today] = (stats.dailyWatchSeconds[today] || 0) + safeDelta;
    changed = true;
  } else if (stats.todayWatchDate !== today) {
    stats.todayWatchDate = today;
    stats.todayWatchSeconds = stats.dailyWatchSeconds[today] || 0;
  }

  const normalizedAnimeKey = input.animeKey.trim().slice(0, 120);
  if (normalizedAnimeKey && !stats.watchedAnimeIds.includes(normalizedAnimeKey)) {
    stats.watchedAnimeIds = [...stats.watchedAnimeIds, normalizedAnimeKey].slice(-500);
    changed = true;
  }

  if (input.completed) {
    const epToken = `${normalizedAnimeKey || input.animeId}:${input.episodeKey || input.episodeNumber}:${today}`;
    const completedKeys = getStoredCompletedEpisodeKeys(uid);
    if (!completedKeys.has(epToken)) {
      completedKeys.add(epToken);
      saveCompletedEpisodeKeys(completedKeys, uid);

      stats.totalEpisodesCompleted = (stats.totalEpisodesCompleted || 0) + 1;
      if (stats.todayCompletedDate === today) {
        stats.todayEpisodesCompleted = (stats.todayEpisodesCompleted || 0) + 1;
      } else {
        stats.todayCompletedDate = today;
        stats.todayEpisodesCompleted = 1;
      }
      changed = true;
    }
  }

  const todayTotalSecs = stats.dailyWatchSeconds[today] || stats.todayWatchSeconds || 0;
  // Mark calendar watch day + daily streak once user genuinely watches >= 60s or completes an episode
  if (todayTotalSecs >= 60 || input.completed) {
    applyDailyStreakForDate(stats, today);
  }

  const newlyUnlocked = evaluateAllBadges(stats);
  if (newlyUnlocked.length > 0) {
    changed = true;
  }

  if (changed) {
    saveStoredWatchStats(stats, uid);
  }

  return {
    stats,
    newlyUnlocked,
    monthKey,
    todayKey: today,
    todayDaySeconds: todayTotalSecs,
    safeDelta,
    changed,
  };
}

export interface RecordCompletionResult {
  stats: UserWatchStats;
  newlyUnlocked: AchievementBadge[];
  alreadyCounted: boolean;
}

export function recordEpisodeCompletionLocally(
  animeId: number,
  episodeNumber: number,
  currentStats?: UserWatchStats
): RecordCompletionResult {
  const beforeEps = currentStats?.totalEpisodesCompleted ?? getStoredWatchStats().totalEpisodesCompleted;
  const res = recordWatchPlaybackLocally(
    {
      animeKey: `anilist:${animeId}`,
      animeId,
      episodeNumber,
      secondsWatched: 0,
      completed: true,
    },
    currentStats
  );
  return {
    stats: res.stats,
    newlyUnlocked: res.newlyUnlocked,
    alreadyCounted: res.stats.totalEpisodesCompleted === beforeEps,
  };
}

export function computeStreakMilestones(currentStreak: number, isAdmin = false): StreakMilestone[] {
  return STREAK_MILESTONES_CONFIG.map((m) => ({
    days: m.days,
    title: m.title,
    rewardBadge: m.rewardBadge,
    unlocked: isAdmin || currentStreak >= m.days,
  }));
}

export interface ResolvedBadgeProgress {
  current: number;
  target: number;
  percent: number;
  unlocked: boolean;
  unlockedAt?: string;
  isAdminUnlock: boolean;
  progressText: string;
}

export function getBadgeProgress(
  badge: AchievementBadge,
  stats: UserWatchStats,
  isAdmin = false
): ResolvedBadgeProgress {
  const { unlockedAchievements, achievementUnlockDates } = normalizeAchievementList(
    stats.unlockedAchievements,
    stats.achievementUnlockDates
  );

  // Special Admin Privileges: every existing and future badge is permanently unlocked for free
  if (isAdmin) {
    return {
      current: badge.targetCount,
      target: badge.targetCount,
      percent: 100,
      unlocked: true,
      unlockedAt: achievementUnlockDates[badge.id] || ADMIN_PERMANENT_UNLOCK_LABEL,
      isAdminUnlock: true,
      progressText: `${badge.targetCount} / ${badge.targetCount} ${badge.unitLabel}`,
    };
  }

  const isUnlocked = unlockedAchievements.includes(badge.id);
  const todayKey = getTodayDateKey();
  const bestStreak = Math.max(
    stats.streakCurrent || 0,
    stats.streakLongest || 0,
    getEffectiveCurrentStreak(stats)
  );
  const todayEps = stats.todayCompletedDate === todayKey ? stats.todayEpisodesCompleted || 0 : 0;
  const todaySecs =
    stats.todayWatchDate === todayKey
      ? stats.todayWatchSeconds || 0
      : stats.dailyWatchSeconds?.[todayKey] || 0;

  let current = 0;
  let progressText = '';

  switch (badge.metricType) {
    case 'first_watch': {
      const done = isUnlocked || (stats.totalEpisodesCompleted || 0) >= 1 || (stats.totalWatchSeconds || 0) >= 60;
      current = done ? 1 : 0;
      progressText = done ? '1 / 1 Watch' : `${Math.min(59, stats.totalWatchSeconds || 0)}s / 60s`;
      break;
    }
    case 'streak':
      current = bestStreak;
      progressText = `${Math.min(current, badge.targetCount)} / ${badge.targetCount} Days`;
      break;
    case 'unique_anime':
      current = (stats.watchedAnimeIds || []).length;
      progressText = `${Math.min(current, badge.targetCount)} / ${badge.targetCount} Series`;
      break;
    case 'episodes':
      current = stats.totalEpisodesCompleted || 0;
      progressText = `${Math.min(current, badge.targetCount)} / ${badge.targetCount} Eps`;
      break;
    case 'daily_binge': {
      // Show whichever metric (episodes today OR 120 mins today) is further along
      const epRatio = todayEps / 5;
      const timeRatio = todaySecs / 7200;
      if (timeRatio > epRatio && !isUnlocked) {
        const minsToday = Math.floor(todaySecs / 60);
        current = Math.min(5, Number((timeRatio * 5).toFixed(2)));
        progressText = `${Math.min(120, minsToday)} / 120 Mins Today`;
      } else {
        current = todayEps;
        progressText = `${Math.min(isUnlocked ? 5 : current, 5)} / 5 Eps Today`;
      }
      break;
    }
    case 'watch_hours': {
      const hours = Number(((stats.totalWatchSeconds || 0) / 3600).toFixed(1));
      current = hours;
      progressText = `${Math.min(hours, badge.targetCount)} / ${badge.targetCount} Hrs`;
      break;
    }
  }

  const target = badge.targetCount;
  const percent = isUnlocked ? 100 : Math.min(100, Math.round((current / target) * 100));

  return {
    current: isUnlocked ? target : Math.min(current, target),
    target,
    percent,
    unlocked: isUnlocked,
    unlockedAt: isUnlocked ? achievementUnlockDates[badge.id] : undefined,
    isAdminUnlock: false,
    progressText,
  };
}

export function resolveEffectiveBadges(
  stats: UserWatchStats,
  isAdmin = false
): Array<{ badge: AchievementBadge; progress: ResolvedBadgeProgress }> {
  return ACHIEVEMENT_BADGES.map((badge) => ({
    badge,
    progress: getBadgeProgress(badge, stats, isAdmin),
  }));
}

export function normalizeEquippedBadges(
  rawIds: unknown,
  stats?: UserWatchStats,
  isAdmin = false
): AchievementId[] {
  if (!Array.isArray(rawIds)) return [];

  const validMap = new Map<string, AchievementBadge>(
    ACHIEVEMENT_BADGES.map((badge) => [badge.id, badge])
  );
  const deduped: AchievementId[] = [];
  const seen = new Set<AchievementId>();

  for (const raw of rawIds) {
    if (typeof raw !== 'string') continue;
    const mappedId = (LEGACY_BADGE_MAP[raw] || raw) as AchievementId;
    const badge = validMap.get(mappedId);
    if (!badge || seen.has(badge.id)) continue;

    if (stats && !isAdmin) {
      const progress = getBadgeProgress(badge, stats, false);
      if (!progress.unlocked) continue;
    }

    seen.add(badge.id);
    deduped.push(badge.id);
    if (deduped.length >= MAX_EQUIPPED_BADGES) break;
  }

  return deduped;
}

export function resolveEquippedBadgeObjects(
  equippedIds: readonly string[],
  stats: UserWatchStats,
  isAdmin = false
): Array<{ badge: AchievementBadge; progress: ResolvedBadgeProgress }> {
  const validMap = new Map<string, AchievementBadge>(
    ACHIEVEMENT_BADGES.map((badge) => [badge.id, badge])
  );
  const seen = new Set<string>();
  const resolved: Array<{ badge: AchievementBadge; progress: ResolvedBadgeProgress }> = [];

  for (const id of equippedIds) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    const badge = validMap.get(id);
    if (!badge) continue;
    const progress = getBadgeProgress(badge, stats, isAdmin);
    if (!isAdmin && !progress.unlocked) continue;
    seen.add(badge.id);
    resolved.push({ badge, progress });
    if (resolved.length >= MAX_EQUIPPED_BADGES) break;
  }

  return resolved;
}
