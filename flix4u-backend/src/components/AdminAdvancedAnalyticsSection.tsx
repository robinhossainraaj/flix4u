import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Film,
  Flame,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Server,
  TrendingUp,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { BADGE_ARTWORK_MAP } from '@/src/assets/badgeArtwork';
import { useAuth } from '@/src/context/AuthContext';
import {
  ACHIEVEMENT_BADGES,
  formatWatchDuration,
  getTodayDateKey,
} from '@/src/services/achievementService';
import {
  fetchAdminRegisteredUsersStats,
  fetchAdminServerStats,
} from '@/src/services/adminService';
import {
  fetchGlobalWatchAnalytics,
  normalizeServerDisplayName,
  subscribeActiveSessions,
  toMillis,
  type ActiveSession,
  type GlobalWatchAnalytics,
  type UserAnalyticsSummary,
} from '@/src/services/watchAnalyticsService';
import { computeLevelFromXp, getLevelTier } from '@/src/services/xpService';
import type { AdminServerStats, RegisteredUsersStats } from '@/src/types/anime';

type DateRangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';
type UserSortField = 'watch' | 'xp' | 'recent';

function offsetDateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function enumerateDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [endKey];
  }
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 120) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return keys;
}

function formatShortDay(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[1]}/${parts[2]}`;
}

function entryDateKey(entry: { watchedDate?: string; updatedAt: unknown }): string {
  if (entry.watchedDate && /^\d{4}-\d{2}-\d{2}$/.test(entry.watchedDate)) {
    return entry.watchedDate;
  }
  const ms = toMillis(entry.updatedAt);
  if (!ms) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const AdminAdvancedAnalyticsSection: React.FC = () => {
  const { getIdToken } = useAuth();

  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customStart, setCustomStart] = useState<string>(() => offsetDateKey(13));
  const [customEnd, setCustomEnd] = useState<string>(() => getTodayDateKey());

  const [watchAnalytics, setWatchAnalytics] = useState<GlobalWatchAnalytics | null>(null);
  const [serverStats, setServerStats] = useState<AdminServerStats | null>(null);
  const [regStats, setRegStats] = useState<RegisteredUsersStats | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [sortBy, setSortBy] = useState<UserSortField>('watch');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserAnalyticsSummary | null>(null);
  const pageSize = 10;

  const loadAll = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setError(null);
      try {
        const token = await getIdToken(false);
        const [watchRes, regRes, srvRes] = await Promise.allSettled([
          fetchGlobalWatchAnalytics(),
          fetchAdminRegisteredUsersStats(),
          token ? fetchAdminServerStats(token) : Promise.resolve(null),
        ]);

        if (watchRes.status === 'fulfilled') setWatchAnalytics(watchRes.value);
        if (regRes.status === 'fulfilled') setRegStats(regRes.value);
        if (srvRes.status === 'fulfilled' && srvRes.value) setServerStats(srvRes.value);
        if (watchRes.status === 'rejected') {
          throw watchRes.reason;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load advanced analytics.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getIdToken]
  );

  useEffect(() => {
    void loadAll();
    const unsub = subscribeActiveSessions((sessions) => setActiveSessions(sessions));
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAll();
      }
    }, 30_000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [loadAll]);

  const dateRange = useMemo(() => {
    const today = getTodayDateKey();
    if (preset === 'today') return { startKey: today, endKey: today, label: 'Today' };
    if (preset === '7d') return { startKey: offsetDateKey(6), endKey: today, label: 'Last 7 Days' };
    if (preset === '30d') return { startKey: offsetDateKey(29), endKey: today, label: 'Last 30 Days' };
    if (preset === '90d') return { startKey: offsetDateKey(89), endKey: today, label: 'Last 90 Days' };
    const safeStart = customStart && customStart <= today ? customStart : offsetDateKey(6);
    const safeEnd = customEnd && customEnd >= safeStart ? customEnd : today;
    return {
      startKey: safeStart,
      endKey: safeEnd,
      label: `${safeStart} → ${safeEnd}`,
    };
  }, [preset, customStart, customEnd]);

  const dateKeysInRange = useMemo(
    () => enumerateDateKeys(dateRange.startKey, dateRange.endKey),
    [dateRange.startKey, dateRange.endKey]
  );

  const computed = useMemo(() => {
    const users = watchAnalytics?.users || [];
    const srvDailyMap = new Map<string, { visits: number; activeUsers: number; registeredActive: number }>();
    for (const pt of serverStats?.dailySeries90 || serverStats?.dailySeries || []) {
      srvDailyMap.set(pt.date, pt);
    }

    const activeUsersSet = new Set<string>();
    const activeTodaySet = new Set<string>();
    const todayKey = getTodayDateKey();
    const weekStart = offsetDateKey(6);
    const monthStart = offsetDateKey(29);
    const wauSet = new Set<string>();
    const mauSet = new Set<string>();

    const dailyWatchMap: Record<string, number> = {};
    const dailyWatchUsersMap: Record<string, Set<string>> = {};
    const dailyRegMap: Record<string, number> = {};

    const animeMap: Record<string, { title: string; count: number; totalSeconds: number; animeId: number }> = {};
    const serverMap: Record<string, { serverName: string; count: number; totalSeconds: number }> = {};

    let rangeWatchSeconds = 0;
    let rangeEpisodesCount = 0;

    for (const u of users) {
      // Signup date aggregation
      const createdMs = toMillis(u.createdAt);
      if (createdMs > 0) {
        const d = new Date(createdMs);
        const cKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        dailyRegMap[cKey] = (dailyRegMap[cKey] || 0) + 1;
      }

      // Daily watch activity
      for (const [dKey, secs] of Object.entries(u.dailyActivity || {})) {
        if (secs <= 0) continue;
        if (dKey === todayKey) activeTodaySet.add(u.uid);
        if (dKey >= weekStart && dKey <= todayKey) wauSet.add(u.uid);
        if (dKey >= monthStart && dKey <= todayKey) mauSet.add(u.uid);

        if (dKey >= dateRange.startKey && dKey <= dateRange.endKey) {
          activeUsersSet.add(u.uid);
          rangeWatchSeconds += secs;
          dailyWatchMap[dKey] = (dailyWatchMap[dKey] || 0) + secs;
          if (!dailyWatchUsersMap[dKey]) dailyWatchUsersMap[dKey] = new Set();
          dailyWatchUsersMap[dKey].add(u.uid);
        }
      }

      // Also inspect lastActiveAt for WAU / MAU / Range active check
      const lastActiveMs = toMillis(u.lastActiveAt);
      if (lastActiveMs > 0) {
        const d = new Date(lastActiveMs);
        const lKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        if (lKey === todayKey) activeTodaySet.add(u.uid);
        if (lKey >= weekStart && lKey <= todayKey) wauSet.add(u.uid);
        if (lKey >= monthStart && lKey <= todayKey) mauSet.add(u.uid);
        if (lKey >= dateRange.startKey && lKey <= dateRange.endKey) activeUsersSet.add(u.uid);
      }

      // Watch history entries filtered by range
      for (const h of u.history) {
        const eKey = entryDateKey(h);
        if (eKey && (eKey < dateRange.startKey || eKey > dateRange.endKey)) {
          continue;
        }
        rangeEpisodesCount += 1;

        const title = (h.title || 'Untitled').trim();
        if (!animeMap[title]) {
          animeMap[title] = { title, count: 0, totalSeconds: 0, animeId: h.animeId || 0 };
        }
        animeMap[title].count += 1;
        animeMap[title].totalSeconds += h.watchedSeconds || 0;

        const srv = normalizeServerDisplayName(h.serverName, h.audioMode);
        if (!serverMap[srv]) {
          serverMap[srv] = { serverName: srv, count: 0, totalSeconds: 0 };
        }
        serverMap[srv].count += 1;
        serverMap[srv].totalSeconds += h.watchedSeconds || 0;
      }
    }

    const dailySeries = dateKeysInRange.map((dateKey) => {
      const srvPt = srvDailyMap.get(dateKey);
      const watchUsers = dailyWatchUsersMap[dateKey]?.size || 0;
      const dau = Math.max(srvPt?.activeUsers || 0, watchUsers);
      const watchSecs = dailyWatchMap[dateKey] || 0;
      const watchMins = Math.round(watchSecs / 60);
      const registrations = dailyRegMap[dateKey] || 0;
      const avgMinsPerUser = dau > 0 ? Math.round((watchMins / dau) * 10) / 10 : 0;
      return {
        date: dateKey,
        dau,
        visits: srvPt?.visits || 0,
        watchSecs,
        watchMins,
        registrations,
        avgMinsPerUser,
      };
    });

    const topAnime = Object.values(animeMap)
      .sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds)
      .slice(0, 8);

    const serverUsage = Object.values(serverMap).sort(
      (a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds
    );

    const totalOnline = Math.max(
      serverStats?.currentlyOnlineUsers || 0,
      activeSessions.length
    );
    const totalUsersToday = Math.max(
      serverStats?.usersActiveToday || 0,
      regStats?.registeredActiveToday || 0,
      activeTodaySet.size
    );
    const wauCount = Math.max(serverStats?.wau || 0, wauSet.size, regStats?.registeredLast7Days || 0);
    const mauCount = Math.max(serverStats?.mau || 0, mauSet.size, regStats?.totalActiveRegisteredUsers || 0);

    return {
      totalRegisteredUsers: Math.max(users.length, regStats?.totalRegisteredUsers || 0),
      totalActiveInRange: activeUsersSet.size,
      totalOnline,
      totalUsersToday,
      wauCount,
      mauCount,
      rangeWatchSeconds,
      lifetimeWatchSeconds: watchAnalytics?.totalWatchTimeSeconds || 0,
      todayWatchSeconds: watchAnalytics?.todayWatchTimeSeconds || 0,
      weeklyWatchSeconds: watchAnalytics?.weeklyWatchTimeSeconds || 0,
      monthlyWatchSeconds: watchAnalytics?.monthlyWatchTimeSeconds || 0,
      rangeEpisodesCount,
      lifetimeEpisodesCount: watchAnalytics?.totalEpisodesWatched || 0,
      mostPopularAnime: topAnime[0] || watchAnalytics?.mostWatchedAnime[0] || null,
      mostUsedServer: serverUsage[0] || watchAnalytics?.popularServers[0] || null,
      dailySeries,
      topAnime,
      serverUsage,
    };
  }, [watchAnalytics, serverStats, regStats, activeSessions, dateRange, dateKeysInRange]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = (watchAnalytics?.users || []).filter((u) => {
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'xp') return b.xp - a.xp || b.totalWatchSeconds - a.totalWatchSeconds;
      if (sortBy === 'recent') return toMillis(b.lastActiveAt) - toMillis(a.lastActiveAt);
      return b.totalWatchSeconds - a.totalWatchSeconds;
    });
    return list;
  }, [watchAnalytics?.users, userSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="kuro-glass rounded-3xl border border-white/[0.08] p-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-400" />
        <p className="mt-3 text-xs sm:text-sm text-slate-400">
          Aggregating platform watch telemetry, user XP, and activity trends...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Filter & Refresh Bar */}
      <div className="kuro-glass rounded-3xl border border-white/[0.08] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-400" />
              <span>Advanced Platform Analytics</span>
            </h2>
            <p className="text-xs text-slate-400">
              Verified Firebase user watch metrics, XP progression, and server traffic ({dateRange.label})
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadAll(true)}
            className="kuro-btn-glass inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-violet-200 self-start md:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Analytics'}</span>
          </button>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-t border-white/[0.08] pt-3.5">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['today', 'Today'],
                ['7d', 'Last 7 Days'],
                ['30d', 'Last 30 Days'],
                ['90d', 'Last 90 Days'],
                ['custom', 'Custom Range'],
              ] as Array<[DateRangePreset, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  preset === key ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Calendar className="h-4 w-4 text-violet-400" />
              <input
                type="date"
                value={customStart}
                max={getTodayDateKey()}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 rounded-xl border border-white/[0.1] bg-[#07080d] px-2.5 text-xs text-white"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                max={getTodayDateKey()}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 rounded-xl border border-white/[0.1] bg-[#07080d] px-2.5 text-xs text-white"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* 8 Overview KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4 text-violet-300" />}
          label="Total Registered Users"
          value={computed.totalRegisteredUsers.toLocaleString()}
          sub={`${computed.mauCount} MAU · ${computed.wauCount} WAU`}
        />
        <KpiCard
          icon={<UserCheck className="h-4 w-4 text-emerald-300" />}
          label="Active Users (Range)"
          value={computed.totalActiveInRange.toLocaleString()}
          sub={`Active within ${dateRange.label}`}
        />
        <KpiCard
          icon={<Radio className="h-4 w-4 text-cyan-300" />}
          label="Currently Online"
          value={computed.totalOnline.toLocaleString()}
          sub={`${activeSessions.length} actively watching video`}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4 text-amber-300" />}
          label="Users Active Today"
          value={computed.totalUsersToday.toLocaleString()}
          sub="Real presence + watch logs"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-fuchsia-300" />}
          label="Watch Time (Range)"
          value={formatWatchDuration(computed.rangeWatchSeconds, 'compact')}
          sub={`Lifetime: ${formatWatchDuration(computed.lifetimeWatchSeconds, 'compact')}`}
        />
        <KpiCard
          icon={<Film className="h-4 w-4 text-indigo-300" />}
          label="Episodes Watched"
          value={computed.rangeEpisodesCount.toLocaleString()}
          sub={`Lifetime: ${computed.lifetimeEpisodesCount.toLocaleString()} eps`}
        />
        <KpiCard
          icon={<Flame className="h-4 w-4 text-rose-300" />}
          label="Most Popular Anime"
          value={computed.mostPopularAnime ? computed.mostPopularAnime.title : 'No Data'}
          sub={
            computed.mostPopularAnime
              ? `${computed.mostPopularAnime.count} sessions · ${formatWatchDuration(
                  computed.mostPopularAnime.totalSeconds,
                  'compact'
                )}`
              : 'Waiting for playback logs'
          }
          compactValue
        />
        <KpiCard
          icon={<Server className="h-4 w-4 text-sky-300" />}
          label="Top Streaming Server"
          value={computed.mostUsedServer ? computed.mostUsedServer.serverName : 'No Data'}
          sub={
            computed.mostUsedServer
              ? `${computed.mostUsedServer.count} streams (${formatWatchDuration(
                  computed.mostUsedServer.totalSeconds,
                  'compact'
                )})`
              : 'No stream data yet'
          }
          compactValue
        />
      </div>

      {/* Charts Grid (8 Charts) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 1. Daily Active Users (DAU) */}
        <BarChartCard
          title="1. Daily Active Users (DAU)"
          subtitle="Combined server presence & verified watch users per day"
          data={computed.dailySeries.map((d) => ({
            label: formatShortDay(d.date),
            value: d.dau,
            tooltip: `${d.date}: ${d.dau} active users`,
          }))}
          barColor="#8b5cf6"
          valueFormatter={(v) => `${v}`}
        />

        {/* 2. Weekly & Monthly Active Users (WAU / MAU) */}
        <ComparisonChartCard
          title="2. Weekly & Monthly Active Users (WAU / MAU)"
          subtitle="Active registered users across Today, 7-Day, 30-Day & Lifetime"
          rows={[
            { label: 'Active Today', value: computed.totalUsersToday, color: '#22d3ee' },
            { label: 'Weekly Active (WAU)', value: computed.wauCount, color: '#8b5cf6' },
            { label: 'Monthly Active (MAU)', value: computed.mauCount, color: '#ec4899' },
            { label: 'Total Registered', value: computed.totalRegisteredUsers, color: '#10b981' },
          ]}
          unit="users"
        />

        {/* 3. Daily Watch Time */}
        <BarChartCard
          title="3. Daily Watch Time"
          subtitle="Total verified playback minutes per day in selected window"
          data={computed.dailySeries.map((d) => ({
            label: formatShortDay(d.date),
            value: d.watchMins,
            tooltip: `${d.date}: ${d.watchMins} mins`,
          }))}
          barColor="#ec4899"
          valueFormatter={(v) => `${v}m`}
        />

        {/* 4. Weekly & Monthly Watch Time */}
        <ComparisonChartCard
          title="4. Weekly & Monthly Watch Time"
          subtitle="Aggregated playback minutes across time horizons"
          rows={[
            {
              label: 'Today Watch Time',
              value: Math.round(computed.todayWatchSeconds / 60),
              color: '#38bdf8',
            },
            {
              label: 'Weekly (7 Days)',
              value: Math.round(computed.weeklyWatchSeconds / 60),
              color: '#a855f7',
            },
            {
              label: 'Monthly (30 Days)',
              value: Math.round(computed.monthlyWatchSeconds / 60),
              color: '#f43f5e',
            },
            {
              label: `Selected (${dateRange.label})`,
              value: Math.round(computed.rangeWatchSeconds / 60),
              color: '#10b981',
            },
          ]}
          unit="mins"
        />

        {/* 5. New User Registrations */}
        <BarChartCard
          title="5. New User Registrations"
          subtitle="Daily Firebase account signups within selected range"
          data={computed.dailySeries.map((d) => ({
            label: formatShortDay(d.date),
            value: d.registrations,
            tooltip: `${d.date}: ${d.registrations} new users`,
          }))}
          barColor="#10b981"
          valueFormatter={(v) => `${v}`}
        />

        {/* 6. Anime Popularity Rankings */}
        <div className="kuro-glass rounded-3xl border border-white/[0.08] p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">6. Anime Popularity Rankings</h3>
            <p className="text-[11px] text-slate-400">
              Top watched titles in {dateRange.label}
            </p>
          </div>
          {computed.topAnime.length === 0 ? (
            <EmptyChartNotice text="No watch history recorded in this date range." />
          ) : (
            <div className="space-y-2.5">
              {computed.topAnime.map((item, idx) => {
                const maxCount = Math.max(1, computed.topAnime[0]?.count || 1);
                const pct = Math.max(6, Math.round((item.count / maxCount) * 100));
                return (
                  <div key={item.title} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-semibold text-white">
                        #{idx + 1} {item.title}
                      </span>
                      <span className="shrink-0 text-slate-300 tabular-nums">
                        {item.count} views · {formatWatchDuration(item.totalSeconds, 'compact')}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 7. Streaming Server Usage Statistics */}
        <div className="kuro-glass rounded-3xl border border-white/[0.08] p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">7. Streaming Server Usage</h3>
            <p className="text-[11px] text-slate-400">
              Share of watch sessions and playback time by server
            </p>
          </div>
          {computed.serverUsage.length === 0 ? (
            <EmptyChartNotice text="No streaming server logs recorded in this date range." />
          ) : (
            <div className="space-y-3">
              {computed.serverUsage.map((srv) => {
                const total = Math.max(
                  1,
                  computed.serverUsage.reduce((acc, s) => acc + s.count, 0)
                );
                const sharePct = Math.round((srv.count / total) * 100);
                return (
                  <div
                    key={srv.serverName}
                    className="rounded-2xl border border-white/[0.06] bg-[#080a13] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-white">{srv.serverName}</span>
                      <span className="font-semibold text-cyan-300 tabular-nums">
                        {sharePct}% ({srv.count} streams)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                        style={{ width: `${Math.max(4, sharePct)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      Watch time: {formatWatchDuration(srv.totalSeconds, 'long')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 8. User Engagement Trends (Avg mins per active user) */}
        <LineChartCard
          title="8. User Engagement Trends"
          subtitle="Average verified watch minutes per active user per day"
          data={computed.dailySeries.map((d) => ({
            label: formatShortDay(d.date),
            value: d.avgMinsPerUser,
            tooltip: `${d.date}: ${d.avgMinsPerUser} avg mins/user`,
          }))}
          strokeColor="#38bdf8"
        />
      </div>

      {/* Searchable Registered Users Table with XP, Level & Badges Inspection */}
      <section className="kuro-glass rounded-3xl border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              Registered User Directory ({filteredUsers.length})
            </h3>
            <p className="text-xs text-slate-400">
              Click any user row to inspect watch history, daily/weekly/monthly stats, XP level, and earned badges
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email or UID..."
                className="h-9 w-full rounded-xl border border-white/[0.1] bg-[#07080d] pl-8 pr-3 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as UserSortField);
                setPage(1);
              }}
              className="h-9 rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs font-semibold text-white"
            >
              <option value="watch">Sort: Watch Time</option>
              <option value="xp">Sort: Level &amp; XP</option>
              <option value="recent">Sort: Last Active</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 pr-3">User</th>
                <th className="py-2.5 px-3">Level &amp; XP</th>
                <th className="py-2.5 px-3">Badges</th>
                <th className="py-2.5 px-3">Today</th>
                <th className="py-2.5 px-3">Lifetime Watch</th>
                <th className="py-2.5 px-3">Episodes</th>
                <th className="py-2.5 pl-3 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {pagedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                pagedUsers.map((u) => {
                  const lvl = computeLevelFromXp(u.xp, false);
                  const tier = getLevelTier(lvl.level);
                  return (
                    <tr
                      key={u.uid}
                      onClick={() => setSelectedUser(u)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.photoURL || '/assets/aistudio/file_00000000d64c8211a7a01231691e7256_8b4ae7b0.png'}
                            alt={u.displayName}
                            className="h-8 w-8 rounded-full object-cover border border-white/15 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="truncate max-w-[160px] font-semibold text-white">
                              {u.displayName}
                            </p>
                            <p className="truncate max-w-[180px] text-[11px] text-slate-400">
                              {u.email || u.uid}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        <span
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold"
                          style={{
                            borderColor: `${tier.accentHex}55`,
                            color: tier.secondaryHex,
                            background: `${tier.accentHex}15`,
                          }}
                        >
                          <Zap className="h-3 w-3" />
                          Lv {lvl.level} · {u.xp.toLocaleString()} XP
                        </span>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-slate-300">
                        {u.unlockedAchievements.length} earned
                      </td>
                      <td className="py-3 px-3 tabular-nums text-emerald-300">
                        {formatWatchDuration(u.todayWatchSeconds, 'compact')}
                      </td>
                      <td className="py-3 px-3 tabular-nums font-semibold text-white">
                        {formatWatchDuration(u.totalWatchSeconds, 'compact')}
                      </td>
                      <td className="py-3 px-3 tabular-nums text-slate-300">
                        {u.totalEpisodesCompleted}
                      </td>
                      <td className="py-3 pl-3 text-right tabular-nums text-slate-400">
                        {u.lastActiveAt
                          ? new Date(toMillis(u.lastActiveAt)).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Never'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="kuro-btn-glass flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="kuro-btn-glass flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Detailed User Inspector Modal */}
      {selectedUser && (
        <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
};

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  compactValue?: boolean;
}> = ({ icon, label, value, sub, compactValue }) => (
  <div className="kuro-glass rounded-2xl border border-white/[0.08] p-4 flex flex-col justify-between gap-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-slate-400 truncate">{label}</span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
        {icon}
      </span>
    </div>
    <p
      className={`font-black text-white truncate tabular-nums ${
        compactValue ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl'
      }`}
      title={value}
    >
      {value}
    </p>
    <p className="text-[11px] text-slate-400 truncate tabular-nums" title={sub}>
      {sub}
    </p>
  </div>
);

const EmptyChartNotice: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-slate-400">
    {text}
  </div>
);

const BarChartCard: React.FC<{
  title: string;
  subtitle: string;
  data: Array<{ label: string; value: number; tooltip: string }>;
  barColor: string;
  valueFormatter: (v: number) => string;
}> = ({ title, subtitle, data, barColor, valueFormatter }) => {
  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const [hovered, setHovered] = useState<number | null>(null);
  const stepLabel = data.length > 20 ? 5 : data.length > 10 ? 2 : 1;

  return (
    <div className="kuro-glass rounded-3xl border border-white/[0.08] p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
        {hovered !== null && data[hovered] && (
          <span className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums">
            {data[hovered].tooltip}
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <EmptyChartNotice text="No data points in selected date range." />
      ) : (
        <div className="space-y-1.5">
          <div className="flex h-40 items-end gap-1 rounded-2xl border border-white/[0.06] bg-[#080a13] px-3 pt-4 pb-2">
            {data.map((pt, idx) => {
              const pct = pt.value > 0 ? Math.max(6, Math.round((pt.value / maxVal) * 100)) : 2;
              return (
                <div
                  key={`${pt.label}-${idx}`}
                  onMouseEnter={() => setHovered(idx)}
                  onMouseLeave={() => setHovered(null)}
                  title={pt.tooltip}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end"
                >
                  <div
                    className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-125"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: pt.value > 0 ? barColor : 'rgba(255,255,255,0.08)',
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums px-1">
            <span>{data[0]?.label}</span>
            <span>Peak: {valueFormatter(maxVal)}</span>
            {stepLabel > 0 && <span>{data[data.length - 1]?.label}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const LineChartCard: React.FC<{
  title: string;
  subtitle: string;
  data: Array<{ label: string; value: number; tooltip: string }>;
  strokeColor: string;
}> = ({ title, subtitle, data, strokeColor }) => {
  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const width = 400;
  const height = 140;
  const pad = 12;

  const points = data.map((pt, idx) => {
    const x =
      data.length <= 1
        ? width / 2
        : pad + (idx / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - (pt.value / maxVal) * (height - pad * 2);
    return { x, y, ...pt };
  });

  const polylineStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="kuro-glass rounded-3xl border border-white/[0.08] p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
        <span className="text-[11px] font-semibold text-cyan-300 tabular-nums">
          Peak: {maxVal}m/user
        </span>
      </div>

      {data.length === 0 ? (
        <EmptyChartNotice text="No engagement points available." />
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-[#080a13] p-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-36 w-full overflow-visible"
            role="img"
            aria-label={title}
          >
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylineStr}
            />
            {points.map((p, idx) => (
              <circle
                key={`${p.label}-${idx}`}
                cx={p.x}
                cy={p.y}
                r={data.length > 25 ? 2.2 : 3.5}
                fill={strokeColor}
              >
                <title>{p.tooltip}</title>
              </circle>
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400 tabular-nums">
            <span>{data[0]?.label}</span>
            <span>{data[data.length - 1]?.label}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const ComparisonChartCard: React.FC<{
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: number; color: string }>;
  unit: string;
}> = ({ title, subtitle, rows, unit }) => {
  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="kuro-glass rounded-3xl border border-white/[0.08] p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-[11px] text-slate-400">{subtitle}</p>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const pct = r.value > 0 ? Math.max(5, Math.round((r.value / maxVal) * 100)) : 2;
          return (
            <div key={r.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="font-semibold text-slate-200">{r.label}</span>
                <span className="font-bold text-white">
                  {r.value.toLocaleString()} {unit}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: r.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const UserDetailsModal: React.FC<{
  user: UserAnalyticsSummary;
  onClose: () => void;
}> = ({ user, onClose }) => {
  const lvl = computeLevelFromXp(user.xp, false);
  const tier = getLevelTier(lvl.level);
  const earnedBadges = ACHIEVEMENT_BADGES.filter((b) => user.unlockedAchievements.includes(b.id));
  const equippedSet = new Set(user.equippedBadges);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="kuro-glass-elevated max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/[0.12] bg-[#0b0d17] p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={user.photoURL || '/assets/aistudio/file_00000000d64c8211a7a01231691e7256_8b4ae7b0.png'}
              alt={user.displayName}
              className="h-14 w-14 rounded-2xl object-cover border border-violet-400/40 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-extrabold text-white truncate">{user.displayName}</h3>
                <span
                  className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-0.5 text-[11px] font-bold"
                  style={{
                    borderColor: `${tier.accentHex}70`,
                    color: tier.secondaryHex,
                    background: `${tier.accentHex}20`,
                  }}
                >
                  <Crown className="h-3 w-3" />
                  Lv {lvl.level} · {lvl.title} ({user.xp.toLocaleString()} XP)
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{user.email || user.uid}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                Last Active:{' '}
                {user.lastActiveAt
                  ? new Date(toMillis(user.lastActiveAt)).toLocaleString()
                  : 'Never'}
                {' · '}Streak: {user.streakCurrent}d (Best {user.streakLongest}d)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-300 hover:text-white"
            aria-label="Close user details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Watch Time Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#080a13] p-3">
            <p className="text-[11px] text-slate-400">Daily Watch Time</p>
            <p className="mt-1 text-base font-extrabold text-emerald-300 tabular-nums">
              {formatWatchDuration(user.todayWatchSeconds, 'compact')}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#080a13] p-3">
            <p className="text-[11px] text-slate-400">Weekly Watch Time</p>
            <p className="mt-1 text-base font-extrabold text-violet-300 tabular-nums">
              {formatWatchDuration(user.weeklyWatchSeconds, 'compact')}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#080a13] p-3">
            <p className="text-[11px] text-slate-400">Monthly Watch Time</p>
            <p className="mt-1 text-base font-extrabold text-fuchsia-300 tabular-nums">
              {formatWatchDuration(user.monthlyWatchSeconds, 'compact')}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#080a13] p-3">
            <p className="text-[11px] text-slate-400">Lifetime Watch Time</p>
            <p className="mt-1 text-base font-extrabold text-white tabular-nums">
              {formatWatchDuration(user.totalWatchSeconds, 'compact')}
            </p>
          </div>
        </div>

        {/* Earned Badges */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#080a13] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              <span>Earned Badges ({earnedBadges.length})</span>
            </h4>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {user.equippedBadges.length} equipped on profile
            </span>
          </div>
          {earnedBadges.length === 0 ? (
            <p className="text-xs text-slate-400">No achievement badges unlocked yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map((b) => {
                const art = BADGE_ARTWORK_MAP[b.id];
                const isEq = equippedSet.has(b.id);
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs"
                    style={{
                      borderColor: `${b.accentHex}66`,
                      background: `${b.accentHex}15`,
                    }}
                  >
                    {art ? (
                      <img src={art} alt={b.title} className="h-6 w-6 rounded-lg object-cover" />
                    ) : (
                      <span>{b.emoji}</span>
                    )}
                    <span className="font-semibold text-white">{b.title}</span>
                    {isEq && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                        Equipped
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Complete Watch History */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300">
            Watch History ({user.history.length})
          </h4>
          {user.history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 py-6 text-center text-xs text-slate-400">
              No episode watch logs found for this user.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#080a13]">
              {user.history.map((h, idx) => (
                <div
                  key={`${h.id || h.episodeId}-${idx}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {h.title} · Episode {h.episodeNumber}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {normalizeServerDisplayName(h.serverName, h.audioMode)}
                      {h.updatedAt ? ` · ${new Date(toMillis(h.updatedAt)).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-violet-300 tabular-nums">
                    {formatWatchDuration(h.watchedSeconds || h.progressSeconds || 0, 'compact')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
