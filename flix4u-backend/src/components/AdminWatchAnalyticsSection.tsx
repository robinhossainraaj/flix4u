import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Film,
  Flame,
  Loader2,
  Pause,
  Radio,
  RefreshCw,
  Search,
  Server,
  Tv,
  Users,
  X,
} from 'lucide-react';
import {
  fetchGlobalWatchAnalytics,
  subscribeActiveSessions,
  exportAnalyticsCsv,
  normalizeServerDisplayName,
  toMillis,
  type ActiveSession,
  type GlobalWatchAnalytics,
  type UserAnalyticsSummary,
  type UserWatchHistoryEntry,
} from '@/src/services/watchAnalyticsService';
import { getTodayDateKey } from '@/src/services/achievementService';

interface AdminWatchAnalyticsSectionProps {
  onRefreshParent?: () => void;
}

function getDateKeyOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getEntryDateKey(entry: UserWatchHistoryEntry): string {
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

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;
  const hrs = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const remSecs = rounded % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins < 10 && remSecs > 0) {
    return `${mins}m ${remSecs}s`;
  }
  return `${mins}m`;
}

function formatClock(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimestamp(val: unknown): string {
  const ms = toMillis(val);
  if (!ms) return 'N/A';
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

function formatRelativeTime(val: unknown): string {
  const ms = toMillis(val);
  if (!ms) return 'Inactive';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export const AdminWatchAnalyticsSection: React.FC<AdminWatchAnalyticsSectionProps> = ({
  onRefreshParent,
}) => {
  const [analytics, setAnalytics] = useState<GlobalWatchAnalytics | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [activeSessionsError, setActiveSessionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Search & Filter state for User Watch History Table
  const [searchQuery, setSearchQuery] = useState('');
  const [serverFilter, setServerFilter] = useState('All');
  const [animeFilter, setAnimeFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all');
  const [customDateFilter, setCustomDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'watchTime' | 'episodes' | 'name'>('recent');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Individual User Details Modal
  const [selectedUser, setSelectedUser] = useState<UserAnalyticsSummary | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlobalWatchAnalytics();
      setAnalytics(data);
      setLastRefreshedAt(new Date());
      setSelectedUser((prev) =>
        prev ? data.users.find((u) => u.uid === prev.uid) || prev : null
      );
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user watch analytics.');
    } finally {
      setLoading(false);
    }
  }, [onRefreshParent]);

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => {
      void loadData();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  // Real-time listener for Currently Watching Active Sessions
  useEffect(() => {
    const unsub = subscribeActiveSessions(
      (sessions) => {
        setActiveSessionsError(null);
        setActiveSessions(sessions);
      },
      (errMessage) => {
        setActiveSessionsError(errMessage);
      }
    );
    return () => unsub();
  }, []);

  const serverOptions = useMemo(() => {
    const defaults = [
      'AnimeWorld India',
      'Flix4U Global',
      'vidstreaming',
      'megacloud',
      'streamsb',
      'munchyroll',
    ];
    const map = new Map<string, string>();
    for (const s of defaults) {
      map.set(s.toLowerCase(), s);
    }
    for (const s of analytics?.popularServers || []) {
      const trimmed = s.serverName.trim();
      if (trimmed) {
        map.set(trimmed.toLowerCase(), trimmed);
      }
    }
    return Array.from(map.values());
  }, [analytics?.popularServers]);

  // Filter and sort user list
  const filteredUsers = useMemo(() => {
    if (!analytics?.users) return [];
    let list = [...analytics.users];
    const todayKey = getTodayDateKey();
    const weekStartKey = getDateKeyOffset(6);
    const monthStartKey = getDateKeyOffset(29);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          u.uid.toLowerCase().includes(q)
      );
    }

    if (animeFilter.trim()) {
      const af = animeFilter.toLowerCase().trim();
      list = list.filter((u) =>
        u.history.some((h) => h.title.toLowerCase().includes(af))
      );
    }

    if (serverFilter !== 'All') {
      const targetServer = serverFilter.toLowerCase();
      list = list.filter((u) =>
        u.history.some((h) => {
          const s = normalizeServerDisplayName(h.serverName, h.audioMode);
          return s.toLowerCase().includes(targetServer);
        })
      );
    }

    if (dateRangeFilter === 'today') {
      list = list.filter(
        (u) =>
          u.todayWatchSeconds > 0 ||
          Boolean(u.dailyActivity[todayKey]) ||
          u.history.some((h) => getEntryDateKey(h) === todayKey)
      );
    } else if (dateRangeFilter === '7d') {
      list = list.filter(
        (u) =>
          u.weeklyWatchSeconds > 0 ||
          Object.keys(u.dailyActivity).some((d) => d >= weekStartKey && d <= todayKey) ||
          u.history.some((h) => {
            const dk = getEntryDateKey(h);
            return dk >= weekStartKey && dk <= todayKey;
          })
      );
    } else if (dateRangeFilter === '30d') {
      list = list.filter(
        (u) =>
          u.monthlyWatchSeconds > 0 ||
          Object.keys(u.dailyActivity).some((d) => d >= monthStartKey && d <= todayKey) ||
          u.history.some((h) => {
            const dk = getEntryDateKey(h);
            return dk >= monthStartKey && dk <= todayKey;
          })
      );
    } else if (dateRangeFilter === 'custom' && customDateFilter) {
      list = list.filter(
        (u) =>
          Boolean(u.dailyActivity[customDateFilter]) ||
          u.history.some((h) => getEntryDateKey(h) === customDateFilter)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'recent') {
        const aTime = toMillis(a.history[0]?.updatedAt || a.lastActiveAt);
        const bTime = toMillis(b.history[0]?.updatedAt || b.lastActiveAt);
        return bTime - aTime;
      }
      if (sortBy === 'watchTime') {
        return b.totalWatchSeconds - a.totalWatchSeconds;
      }
      if (sortBy === 'episodes') {
        return b.totalEpisodesCompleted - a.totalEpisodesCompleted;
      }
      if (sortBy === 'name') {
        return a.displayName.localeCompare(b.displayName);
      }
      return 0;
    });

    return list;
  }, [
    analytics?.users,
    searchQuery,
    animeFilter,
    serverFilter,
    dateRangeFilter,
    customDateFilter,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const now = Date.now();
  const livePlayingCount = activeSessions.filter((s) => {
    const ms = toMillis(s.updatedAt);
    return (ms === 0 || now - ms <= 45000) && s.status !== 'paused';
  }).length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="kuro-glass rounded-3xl p-5 sm:p-6 border border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
              <Film className="h-3.5 w-3.5" />
              <span>User Watch Telemetry</span>
            </div>
            <h2 className="mt-2 text-lg sm:text-xl font-bold text-white tracking-tight">
              User Watch Analytics &amp; Live Presence
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
              Real-time playback heartbeats, chronological episode durations, and registered user watch statistics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] text-slate-400 tabular-nums">
              Refreshed {lastRefreshedAt.toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="kuro-btn-glass inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => exportAnalyticsCsv(filteredUsers)}
              disabled={filteredUsers.length === 0}
              className="kuro-btn-primary inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs sm:text-sm text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 Primary Top KPI Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          <div className="rounded-2xl border border-white/[0.08] bg-[#090b14]/90 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Watch Time</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white tabular-nums">
              {formatDuration(analytics?.totalWatchTimeSeconds || 0)}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
              Today {formatDuration(analytics?.todayWatchTimeSeconds || 0)} · 7d{' '}
              {formatDuration(analytics?.weeklyWatchTimeSeconds || 0)} · 30d{' '}
              {formatDuration(analytics?.monthlyWatchTimeSeconds || 0)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#090b14]/90 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Episodes &amp; Videos Watched</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
                <Tv className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white tabular-nums">
              {analytics?.totalEpisodesWatched || 0}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
              {analytics?.totalWatchSessions || 0} logged watch sessions
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#090b14]/90 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Currently Watching</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Radio className="h-4 w-4 animate-pulse" />
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-extrabold text-white tabular-nums">
                {activeSessions.length}
              </span>
              {livePlayingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {livePlayingCount} active now
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Live playback heartbeat sessions
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#090b14]/90 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Tracked Registered Users</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white tabular-nums">
              {analytics?.users.length || 0}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Verified Firestore user accounts
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 2: CURRENTLY WATCHING (LIVE) & RECENTLY WATCHED
          ======================================================== */}
      <section className="kuro-glass rounded-3xl p-5 sm:p-6 border border-white/[0.08] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Currently Watching — Live Sessions ({activeSessions.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Real-time playback heartbeats (live vs paused vs recent)
          </span>
        </div>

        {activeSessionsError && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Active sessions listener error: {activeSessionsError}</span>
          </div>
        )}

        {activeSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-white/[0.1] bg-[#080a12]/60 text-center px-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-400">
              <Radio className="h-5 w-5" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-slate-300">No active live streams right now</p>
            <p className="mt-1 text-xs text-slate-500 max-w-md">
              When authenticated users press Play in Flix4U or AnimeWorld India, their live playback state, episode, watched duration, and server appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeSessions.map((session) => {
              const sessionMs = toMillis(session.updatedAt);
              const isStale = sessionMs > 0 && now - sessionMs > 45000;
              const status = session.status || 'playing';
              const progressSec = session.progressSeconds || 0;
              const durationSec = session.durationSeconds || 0;
              const pct = durationSec > 0 ? Math.min(100, Math.round((progressSec / durationSec) * 100)) : 0;

              let statusBadge = (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Streaming Now</span>
                </span>
              );
              if (isStale) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                    <span>Idle</span>
                  </span>
                );
              } else if (status === 'buffering') {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    <span>Buffering</span>
                  </span>
                );
              } else if (status === 'paused') {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    <Pause className="h-2.5 w-2.5" />
                    <span>Paused</span>
                  </span>
                );
              }

              return (
                <div
                  key={session.id || session.userId}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090b14]/95 p-4 space-y-3 transition-all hover:border-violet-500/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-violet-600/20 border border-violet-500/30">
                        {session.userAvatar ? (
                          <img
                            src={session.userAvatar}
                            alt={session.userName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-violet-300 font-bold text-sm">
                            {session.userName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        {!isStale && status === 'playing' && (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#090b14]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white truncate block">
                          {session.userName}
                        </span>
                        {session.userEmail && (
                          <span className="text-[11px] text-slate-400 truncate block">
                            {session.userEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    {statusBadge}
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 space-y-1.5">
                    <div className="text-xs font-semibold text-violet-200 truncate">
                      {session.animeTitle}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="truncate">
                        Episode {session.episodeNumber}
                        {session.episodeTitle ? ` · ${session.episodeTitle}` : ''}
                      </span>
                      <span className="shrink-0 rounded bg-violet-950/60 border border-violet-500/30 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                        {normalizeServerDisplayName(session.serverName)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-emerald-300/90 tabular-nums">
                      <span>Session playback: {formatDuration(session.watchedSeconds || 0)}</span>
                      {durationSec > 0 && (
                        <span className="text-slate-400">
                          {formatClock(progressSec)} / {formatClock(durationSec)} ({pct}%)
                        </span>
                      )}
                    </div>

                    {durationSec > 0 && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>Last activity: {formatRelativeTime(session.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = analytics?.users.find((u) => u.uid === session.userId);
                        if (target) setSelectedUser(target);
                      }}
                      className="text-violet-400 hover:text-violet-300 font-semibold"
                    >
                      Inspect User &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recently Watched Sessions (Distinct from Active Live Heartbeats) */}
        <div className="pt-2 border-t border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recently Watched Sessions
            </h4>
            <span className="text-[11px] text-slate-500">
              Latest completed &amp; paused episode logs
            </span>
          </div>

          {!analytics?.recentWatchSessions || analytics.recentWatchSessions.length === 0 ? (
            <p className="text-xs text-slate-500">No recent watch sessions recorded yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {analytics.recentWatchSessions.slice(0, 6).map((item, idx) => {
                const watchedSec = item.watchedSeconds || item.progressSeconds || 0;
                return (
                  <button
                    key={`${item.userId}-${item.id || item.episodeId}-${idx}`}
                    type="button"
                    onClick={() => {
                      const target = analytics.users.find((u) => u.uid === item.userId);
                      if (target) setSelectedUser(target);
                    }}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-white/[0.06] bg-[#090b14]/80 p-2.5 text-left transition-colors hover:border-violet-500/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg overflow-hidden bg-violet-600/20 shrink-0">
                        {item.userAvatar ? (
                          <img src={item.userAvatar} alt={item.userName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-violet-300">
                            {item.userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{item.userName}</span>
                          <span className="rounded bg-white/[0.06] px-1.5 py-0.2 text-[9px] font-semibold text-slate-400">
                            Recent
                          </span>
                        </div>
                        <span className="text-[11px] text-violet-300 truncate block">
                          {item.title} · Ep {item.episodeNumber}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {normalizeServerDisplayName(item.serverName, item.audioMode)} · {formatRelativeTime(item.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-[11px] font-bold text-emerald-300 tabular-nums">
                        {formatDuration(watchedSec)}
                      </span>
                      {item.completed && (
                        <span className="text-[9px] font-semibold text-violet-300">Completed</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          SECTION 3: ANALYTICS DASHBOARD BREAKDOWNS
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Most Watched Anime */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#090b14]/90 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Most Watched Anime</h3>
          </div>
          {analytics?.mostWatchedAnime && analytics.mostWatchedAnime.length > 0 ? (
            <div className="space-y-2">
              {analytics.mostWatchedAnime.slice(0, 5).map((anime, idx) => (
                <div
                  key={anime.title}
                  className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                        idx === 0
                          ? 'bg-amber-500 text-black shadow-md'
                          : idx === 1
                            ? 'bg-slate-300 text-black'
                            : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-white/[0.05] text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-200 truncate block">
                        {anime.title}
                      </span>
                      {anime.totalSeconds > 0 && (
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {formatDuration(anime.totalSeconds)} watched
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="rounded-lg bg-violet-500/10 px-2 py-0.5 text-xs font-bold text-violet-300 tabular-nums shrink-0 ml-2">
                    {anime.count} {anime.count === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No watch records yet.</p>
          )}
        </div>

        {/* Popular Streaming Servers */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#090b14]/90 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Popular Streaming Servers</h3>
          </div>
          {analytics?.popularServers && analytics.popularServers.length > 0 ? (
            <div className="space-y-3 pt-1">
              {analytics.popularServers.map((server) => {
                const totalServerHits = analytics.popularServers.reduce((acc, s) => acc + s.count, 0) || 1;
                const pct = Math.round((server.count / totalServerHits) * 100);
                return (
                  <div key={server.serverName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-semibold text-slate-200 truncate">{server.serverName}</span>
                      <span className="font-bold text-white tabular-nums shrink-0">
                        {server.count} ({pct}%) · {formatDuration(server.totalSeconds)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No streaming server telemetry recorded yet.</p>
          )}
        </div>

        {/* Most Active Watchers */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#090b14]/90 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Most Active Watchers</h3>
          </div>
          {analytics?.mostActiveUsers && analytics.mostActiveUsers.length > 0 ? (
            <div className="space-y-2">
              {analytics.mostActiveUsers.slice(0, 5).map((user, idx) => (
                <div
                  key={user.uid}
                  onClick={() => setSelectedUser(user)}
                  className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5 cursor-pointer hover:border-violet-500/40 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-slate-400 w-4">#{idx + 1}</span>
                    <div className="h-7 w-7 rounded-lg overflow-hidden bg-violet-600/20 shrink-0">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-violet-300">
                          {user.displayName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white truncate block">
                        {user.displayName}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {user.totalEpisodesCompleted} eps · Today {formatDuration(user.todayWatchSeconds)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-amber-300 tabular-nums ml-2 shrink-0">
                    {formatDuration(user.totalWatchSeconds)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No active watch records yet.</p>
          )}
        </div>
      </div>

      {/* ========================================================
          SECTION 4: USER WATCH HISTORY TABLE & CONTROLS
          ======================================================== */}
      <section className="kuro-glass rounded-3xl p-5 sm:p-6 border border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Registered Users &amp; Watch History
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Showing {filteredUsers.length} registered accounts. Click any user to open their detailed watch history page.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-xl border border-white/[0.08] bg-[#090b14] px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search name or email..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#070912] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="relative">
            <Film className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={animeFilter}
              onChange={(e) => {
                setAnimeFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by anime title..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#070912] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={serverFilter}
              onChange={(e) => {
                setServerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-white/[0.08] bg-[#070912] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="All">All Streaming Servers</option>
              {serverOptions.map((srv) => (
                <option key={srv} value={srv}>
                  {srv}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-1.5">
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-white/[0.08] bg-[#070912] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Specific Date</option>
            </select>
            {dateRangeFilter === 'custom' && (
              <input
                type="date"
                value={customDateFilter}
                onChange={(e) => {
                  setCustomDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-white/[0.08] bg-[#070912] px-2 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
            )}
          </div>

          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-white/[0.08] bg-[#070912] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="recent">Sort by Most Recent</option>
              <option value="watchTime">Sort by Total Watch Time</option>
              <option value="episodes">Sort by Episodes Watched</option>
              <option value="name">Sort by Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* User Watch History Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03] text-slate-400 font-semibold">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Last Watched Anime</th>
                <th className="py-3 px-4">Server</th>
                <th className="py-3 px-4">Last Watch Time</th>
                <th className="py-3 px-4">Total Time</th>
                <th className="py-3 px-4">Episodes</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const lastHistory = user.history[0];
                  const server = lastHistory
                    ? normalizeServerDisplayName(lastHistory.serverName, lastHistory.audioMode)
                    : '—';

                  return (
                    <tr
                      key={user.uid}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl overflow-hidden bg-violet-600/20 border border-violet-500/20 shrink-0">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-violet-300">
                                {user.displayName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 max-w-[160px] sm:max-w-[210px]">
                            <span className="font-bold text-white truncate block">
                              {user.displayName}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {user.email || 'Email not synced'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {lastHistory ? (
                          <div className="min-w-0 max-w-[190px] sm:max-w-[250px]">
                            <span className="font-semibold text-slate-200 truncate block">
                              {lastHistory.title}
                            </span>
                            <span className="text-[11px] text-violet-300 truncate block">
                              Episode {lastHistory.episodeNumber}
                              {lastHistory.episodeTitle ? ` · ${lastHistory.episodeTitle}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No history yet</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-lg bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {server}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-300 tabular-nums">
                        {lastHistory
                          ? formatTimestamp(lastHistory.updatedAt)
                          : user.lastActiveAt
                            ? formatTimestamp(user.lastActiveAt)
                            : 'Never'}
                      </td>

                      <td className="py-3 px-4 font-bold text-white tabular-nums">
                        <span>{formatDuration(user.totalWatchSeconds)}</span>
                        {user.todayWatchSeconds > 0 && (
                          <span className="block text-[10px] font-normal text-emerald-300">
                            Today: {formatDuration(user.todayWatchSeconds)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-200 tabular-nums">
                        {user.totalEpisodesCompleted}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {user.history.length} logs
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                          }}
                          className="kuro-btn-glass rounded-xl px-2.5 py-1 text-xs font-semibold text-violet-300 hover:text-white"
                        >
                          Details &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Page {currentPage} of {totalPages} ({filteredUsers.length} users total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="kuro-btn-glass flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-8 w-8 rounded-xl text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'kuro-btn-glass text-slate-300 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="kuro-btn-glass flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================
          MODAL: INDIVIDUAL USER WATCH ACTIVITY DETAILS
          ======================================================== */}
      {selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-fade-in"
        >
          <div className="kuro-glass relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-violet-500/40 bg-[#0d101d] p-5 sm:p-7 shadow-[0_25px_80px_-15px_rgba(139,92,246,0.65)] space-y-6">
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              aria-label="Close details"
              className="kuro-btn-glass absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* User Profile Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-white/[0.08] pb-5 pr-10">
              <div className="h-16 w-16 rounded-2xl overflow-hidden bg-violet-600/30 border border-violet-500/40 shrink-0">
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-violet-300">
                    {selectedUser.displayName.charAt(0)}
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-white">{selectedUser.displayName}</h3>
                  <span className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300 font-mono">
                    UID: {selectedUser.uid.slice(0, 8)}...
                  </span>
                </div>
                <p className="text-xs text-slate-400">{selectedUser.email || 'No email associated'}</p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                  <span>Joined: {formatTimestamp(selectedUser.createdAt)}</span>
                  <span>•</span>
                  <span>Last Active: {formatRelativeTime(selectedUser.lastActiveAt)}</span>
                </div>
              </div>
            </div>

            {/* Watch Time Breakdown: Daily / Weekly / Monthly / Lifetime + Episodes & Streaks */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 block">Today</span>
                <span className="text-base font-black text-emerald-300 tabular-nums block mt-1">
                  {formatDuration(selectedUser.todayWatchSeconds)}
                </span>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 block">Weekly (7d)</span>
                <span className="text-base font-black text-cyan-300 tabular-nums block mt-1">
                  {formatDuration(selectedUser.weeklyWatchSeconds)}
                </span>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 block">Monthly (30d)</span>
                <span className="text-base font-black text-fuchsia-300 tabular-nums block mt-1">
                  {formatDuration(selectedUser.monthlyWatchSeconds)}
                </span>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 block">Lifetime</span>
                <span className="text-base font-black text-white tabular-nums block mt-1">
                  {formatDuration(selectedUser.totalWatchSeconds)}
                </span>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 block">Episodes</span>
                <span className="text-base font-black text-violet-300 tabular-nums block mt-1">
                  {selectedUser.totalEpisodesCompleted}
                </span>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 block">Streak / Best</span>
                <span className="text-base font-black text-amber-400 tabular-nums block mt-1">
                  {selectedUser.streakCurrent}d / {selectedUser.streakLongest}d
                </span>
              </div>
            </div>

            {/* Daily Watch Time breakdown */}
            {selectedUser.dailyActivity && Object.keys(selectedUser.dailyActivity).length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#070912] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-violet-400" />
                    <span>Daily Watch Time Log</span>
                  </span>
                  <span className="text-slate-500">
                    {Object.keys(selectedUser.dailyActivity).length} active days recorded
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pt-1">
                  {Object.entries(selectedUser.dailyActivity)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([date, secs]) => (
                      <span
                        key={date}
                        className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200 tabular-nums"
                      >
                        <strong>{date}</strong>: {formatDuration(secs)}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Complete Chronological Watch History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">
                  Chronological Watch History &amp; Episode Durations ({selectedUser.history.length})
                </h4>
              </div>

              {selectedUser.history.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No video watch history recorded for this user yet.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {selectedUser.history.map((item, idx) => {
                    const server = normalizeServerDisplayName(item.serverName, item.audioMode);
                    const progressSec = item.progressSeconds || 0;
                    const durationSec = item.durationSeconds || 0;
                    const watchedSec = item.watchedSeconds || progressSec || 0;
                    const pct = durationSec > 0 ? Math.min(100, Math.round((progressSec / durationSec) * 100)) : 0;

                    return (
                      <div
                        key={`${item.id || item.animeId}-${item.episodeId}-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#090b14] p-3 hover:border-violet-500/30 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-10 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                            {item.coverImage ? (
                              <img src={item.coverImage} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                <Film className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <span className="text-xs font-bold text-white truncate block">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-violet-300 block truncate">
                              Episode {item.episodeNumber}
                              {item.episodeTitle ? ` · ${item.episodeTitle}` : ''}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-300">
                                {server}
                              </span>
                              {item.audioMode && (
                                <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300 uppercase font-bold">
                                  {item.audioMode}
                                </span>
                              )}
                              {item.completed && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="sm:text-right shrink-0 space-y-1">
                          <span className="text-[11px] font-bold text-emerald-300 block tabular-nums">
                            Watched: {formatDuration(watchedSec)}
                          </span>
                          <span className="text-[11px] text-slate-400 block tabular-nums">
                            {formatTimestamp(item.updatedAt)}
                          </span>
                          {durationSec > 0 && (
                            <span className="text-[10px] text-slate-400 block tabular-nums">
                              Pos: {formatClock(progressSec)} / {formatClock(durationSec)} ({pct}%)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="kuro-btn-primary rounded-xl px-5 py-2 text-xs font-bold text-white"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
