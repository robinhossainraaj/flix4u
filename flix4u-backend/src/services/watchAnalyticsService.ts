import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, logFirestoreError, OperationType } from '@/src/lib/firebase';
import { getTodayDateKey } from '@/src/services/achievementService';

export type ActiveSessionStatus = 'playing' | 'paused' | 'buffering';

export interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  animeId: number;
  animeTitle: string;
  episodeNumber: number;
  episodeTitle?: string;
  serverName: string;
  status?: ActiveSessionStatus;
  watchedSeconds?: number;
  progressSeconds?: number;
  durationSeconds?: number;
  updatedAt: any;
}

export interface UserWatchHistoryEntry {
  id?: string;
  animeId: number;
  title: string;
  coverImage?: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle?: string;
  serverName?: string;
  watchedSeconds?: number;
  progressSeconds: number;
  durationSeconds: number;
  audioMode?: string;
  completed?: boolean;
  watchedDate?: string;
  startedAt?: any;
  updatedAt: any;
}

export interface UserAnalyticsSummary {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  createdAt?: any;
  lastActiveAt?: any;
  xp: number;
  level: number;
  unlockedAchievements: string[];
  equippedBadges: string[];
  totalEpisodesCompleted: number;
  totalWatchSeconds: number;
  todayWatchSeconds: number;
  weeklyWatchSeconds: number;
  monthlyWatchSeconds: number;
  streakCurrent: number;
  streakLongest: number;
  history: UserWatchHistoryEntry[];
  dailyActivity: Record<string, number>;
}

export interface GlobalWatchAnalytics {
  users: UserAnalyticsSummary[];
  activeSessions: ActiveSession[];
  recentWatchSessions: Array<
    UserWatchHistoryEntry & {
      userId: string;
      userName: string;
      userEmail?: string;
      userAvatar?: string;
    }
  >;
  totalWatchTimeSeconds: number;
  todayWatchTimeSeconds: number;
  weeklyWatchTimeSeconds: number;
  monthlyWatchTimeSeconds: number;
  totalEpisodesWatched: number;
  totalWatchSessions: number;
  mostWatchedAnime: { title: string; count: number; totalSeconds: number; animeId: number }[];
  mostActiveUsers: UserAnalyticsSummary[];
  popularServers: { serverName: string; count: number; totalSeconds: number }[];
  dailyWatchTrend: { date: string; seconds: number }[];
}

export function toMillis(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object') {
    const obj = val as { toMillis?: () => number; seconds?: number };
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.seconds === 'number') return Number(obj.seconds) * 1000;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function getDateKeyOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeServerDisplayName(rawServer?: string, audioMode?: string): string {
  const s = (rawServer || '').trim();
  if (!s) {
    return audioMode === 'hindi' ? 'AnimeWorld India' : 'Flix4U Global';
  }
  const lower = s.toLowerCase();
  if (lower === 'animeworld-india' || lower === 'animeworld india') {
    return 'AnimeWorld India';
  }
  return s;
}

export async function updateActiveWatchSession(
  session: Omit<ActiveSession, 'updatedAt'>
): Promise<boolean> {
  if (!db || !session.userId) return false;
  const path = `active_sessions/${session.userId}`;
  try {
    const docRef = doc(db, 'active_sessions', session.userId);
    const payload: Record<string, unknown> = {
      id: session.userId,
      userId: session.userId,
      userName: (session.userName?.trim() || 'Anime Fan').slice(0, 120),
      animeId: Number.isFinite(session.animeId) && session.animeId > 0 ? Math.round(session.animeId) : 1,
      animeTitle: (session.animeTitle?.trim() || 'Anime Stream').slice(0, 240),
      episodeNumber:
        Number.isFinite(session.episodeNumber) && session.episodeNumber >= 0
          ? Math.round(session.episodeNumber)
          : 1,
      serverName: normalizeServerDisplayName(session.serverName).slice(0, 80),
      status: session.status || 'playing',
      watchedSeconds: Math.max(0, Math.round(Number(session.watchedSeconds) || 0)),
      progressSeconds: Math.max(0, Math.round(Number(session.progressSeconds) || 0)),
      durationSeconds: Math.max(0, Math.round(Number(session.durationSeconds) || 0)),
      updatedAt: serverTimestamp(),
    };

    if (session.userEmail && session.userEmail.trim()) {
      payload.userEmail = session.userEmail.trim().slice(0, 160);
    }
    if (session.userAvatar && session.userAvatar.trim()) {
      payload.userAvatar = session.userAvatar.trim().slice(0, 500);
    }
    if (session.episodeTitle && session.episodeTitle.trim()) {
      payload.episodeTitle = session.episodeTitle.trim().slice(0, 240);
    }

    await setDoc(docRef, payload);
    return true;
  } catch (err) {
    logFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

export async function clearActiveWatchSession(userId: string): Promise<void> {
  if (!db || !userId) return;
  const path = `active_sessions/${userId}`;
  try {
    const docRef = doc(db, 'active_sessions', userId);
    await deleteDoc(docRef);
  } catch (err) {
    logFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeActiveSessions(
  callback: (sessions: ActiveSession[]) => void,
  onError?: (message: string) => void
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = collection(db, 'active_sessions');
  const unsub = onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const list: ActiveSession[] = [];
      snap.forEach((dSnap) => {
        const data = dSnap.data() as ActiveSession;
        const updatedMs = toMillis(data.updatedAt);
        // Keep active/paused sessions updated within last 3 minutes; stale tabs expire cleanly
        if (updatedMs === 0 || now - updatedMs <= 180000) {
          list.push({ ...data, id: dSnap.id });
        }
      });
      list.sort((a, b) => {
        const aLive = a.status !== 'paused' && Date.now() - toMillis(a.updatedAt) <= 45000 ? 1 : 0;
        const bLive = b.status !== 'paused' && Date.now() - toMillis(b.updatedAt) <= 45000 ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        return toMillis(b.updatedAt) - toMillis(a.updatedAt);
      });
      callback(list);
    },
    (error) => {
      logFirestoreError(error, OperationType.LIST, 'active_sessions');
      if (onError) {
        onError(error instanceof Error ? error.message : 'Unable to listen to active watching sessions.');
      }
      callback([]);
    }
  );
  return unsub;
}

export async function fetchGlobalWatchAnalytics(): Promise<GlobalWatchAnalytics> {
  if (!db) {
    return {
      users: [],
      activeSessions: [],
      recentWatchSessions: [],
      totalWatchTimeSeconds: 0,
      todayWatchTimeSeconds: 0,
      weeklyWatchTimeSeconds: 0,
      monthlyWatchTimeSeconds: 0,
      totalEpisodesWatched: 0,
      totalWatchSessions: 0,
      mostWatchedAnime: [],
      mostActiveUsers: [],
      popularServers: [],
      dailyWatchTrend: [],
    };
  }

  let usersSnap;
  try {
    usersSnap = await getDocs(collection(db, 'users'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  const todayKey = getTodayDateKey();
  const weekStartKey = getDateKeyOffset(6);
  const monthStartKey = getDateKeyOffset(29);

  const animeFrequencyMap: Record<string, { title: string; count: number; totalSeconds: number; animeId: number }> = {};
  const dailyTrendMap: Record<string, number> = {};
  const serverFrequencyMap: Record<string, { count: number; totalSeconds: number }> = {};

  let totalWatchTimeSeconds = 0;
  let todayWatchTimeSeconds = 0;
  let weeklyWatchTimeSeconds = 0;
  let monthlyWatchTimeSeconds = 0;
  let totalEpisodesWatched = 0;
  let totalWatchSessions = 0;

  const recentWatchSessions: GlobalWatchAnalytics['recentWatchSessions'] = [];

  // Process users in parallel batches of 10 for fast Admin loading
  const userDocs = usersSnap.docs;
  const users: UserAnalyticsSummary[] = [];

  for (let i = 0; i < userDocs.length; i += 10) {
    const batchDocs = userDocs.slice(i, i + 10);
    const batchResults = await Promise.all(
      batchDocs.map(async (userDoc) => {
        const userData = userDoc.data();
        const uid = userDoc.id;
        const historyPath = `users/${uid}/history`;
        const watchLogsPath = `users/${uid}/watchLogs`;
        const activityPath = `users/${uid}/watchActivity`;

        const [histSnap, logsSnap, actSnap] = await Promise.all([
          getDocs(collection(db!, historyPath)).catch((err) => {
            handleFirestoreError(err, OperationType.LIST, historyPath);
          }),
          getDocs(collection(db!, watchLogsPath)).catch((err) => {
            handleFirestoreError(err, OperationType.LIST, watchLogsPath);
          }),
          getDocs(collection(db!, activityPath)).catch((err) => {
            handleFirestoreError(err, OperationType.LIST, activityPath);
          }),
        ]);

        const combinedHistory: UserWatchHistoryEntry[] = [];
        const coveredEpisodeKeys = new Set<string>();

        // 1. Primary source: chronological per-episode watchLogs
        logsSnap.docs.forEach((lDoc) => {
          const d = lDoc.data();
          const serverName = normalizeServerDisplayName(
            typeof d.serverName === 'string' ? d.serverName : undefined,
            typeof d.audioMode === 'string' ? d.audioMode : undefined
          );
          const entry: UserWatchHistoryEntry = {
            id: lDoc.id,
            animeId: Number(d.animeId || 0),
            title: String(d.animeTitle || d.title || 'Untitled'),
            coverImage: typeof d.coverImage === 'string' ? d.coverImage : '',
            episodeId: String(d.episodeId || ''),
            episodeNumber: Number(d.episodeNumber || 1),
            episodeTitle: typeof d.episodeTitle === 'string' ? d.episodeTitle : undefined,
            serverName,
            watchedSeconds: Math.max(0, Number(d.watchedSeconds || 0)),
            progressSeconds: Math.max(0, Number(d.progressSeconds || 0)),
            durationSeconds: Math.max(0, Number(d.durationSeconds || 0)),
            audioMode: typeof d.audioMode === 'string' ? d.audioMode : 'sub',
            completed: Boolean(d.completed),
            watchedDate: typeof d.watchedDate === 'string' ? d.watchedDate : undefined,
            startedAt: d.startedAt,
            updatedAt: d.updatedAt,
          };
          combinedHistory.push(entry);
          coveredEpisodeKeys.add(`${entry.animeId}:${entry.episodeNumber}`);
        });

        // 2. Legacy fallback: users/{uid}/history (if an anime wasn't logged in watchLogs yet)
        histSnap.docs.forEach((hDoc) => {
          const d = hDoc.data();
          const animeId = Number(d.animeId || 0);
          const episodeNumber = Number(d.episodeNumber || 1);
          const key = `${animeId}:${episodeNumber}`;
          if (coveredEpisodeKeys.has(key)) return;

          const serverName = normalizeServerDisplayName(
            typeof d.serverName === 'string' ? d.serverName : undefined,
            typeof d.audioMode === 'string' ? d.audioMode : undefined
          );
          combinedHistory.push({
            id: hDoc.id,
            animeId,
            title: String(d.title || 'Untitled'),
            coverImage: typeof d.coverImage === 'string' ? d.coverImage : '',
            episodeId: String(d.episodeId || ''),
            episodeNumber,
            episodeTitle: typeof d.episodeTitle === 'string' ? d.episodeTitle : undefined,
            serverName,
            watchedSeconds: Math.max(0, Number(d.progressSeconds || 0)),
            progressSeconds: Math.max(0, Number(d.progressSeconds || 0)),
            durationSeconds: Math.max(0, Number(d.durationSeconds || 0)),
            audioMode: typeof d.audioMode === 'string' ? d.audioMode : 'sub',
            updatedAt: d.updatedAt,
          });
        });

        combinedHistory.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));

        // Daily watch activity aggregation
        const dailyActivity: Record<string, number> = {};
        actSnap.docs.forEach((aDoc) => {
          const aData = aDoc.data();
          const days = aData?.days;
          if (days && typeof days === 'object') {
            for (const [dateStr, secs] of Object.entries(days)) {
              if (typeof secs === 'number' && Number.isFinite(secs) && secs > 0) {
                const rounded = Math.round(secs);
                dailyActivity[dateStr] = rounded;
              }
            }
          }
        });

        let userTodaySecs = dailyActivity[todayKey] || 0;
        let userWeeklySecs = 0;
        let userMonthlySecs = 0;
        let sumDailySecs = 0;

        for (const [dateStr, secs] of Object.entries(dailyActivity)) {
          sumDailySecs += secs;
          if (dateStr >= weekStartKey && dateStr <= todayKey) {
            userWeeklySecs += secs;
          }
          if (dateStr >= monthStartKey && dateStr <= todayKey) {
            userMonthlySecs += secs;
          }
        }

        // Fall back to userDoc's todayWatchSeconds if watchActivity hasn't been written yet
        if (userTodaySecs === 0 && userData.todayWatchDate === todayKey && Number(userData.todayWatchSeconds || 0) > 0) {
          userTodaySecs = Math.round(Number(userData.todayWatchSeconds));
        }

        const totalLogsWatchSecs = combinedHistory.reduce(
          (sum, h) => sum + (h.watchedSeconds || 0),
          0
        );
        const userWatchSecs = Math.max(
          Number(userData.totalWatchSeconds || 0),
          sumDailySecs,
          totalLogsWatchSecs
        );

        const userEpisodes = Math.max(
          Number(userData.totalEpisodesCompleted || 0),
          combinedHistory.filter((h) => h.completed).length
        );

        return {
          uid,
          displayName: userData.displayName || 'Anonymous User',
          email: typeof userData.email === 'string' && userData.email.trim() ? userData.email.trim() : undefined,
          photoURL: typeof userData.photoURL === 'string' ? userData.photoURL : undefined,
          createdAt: userData.createdAt,
          lastActiveAt: userData.lastActiveAt || combinedHistory[0]?.updatedAt || userData.updatedAt,
          xp: Math.max(0, Number(userData.xp || 0)),
          level: Math.max(1, Number(userData.level || 1)),
          unlockedAchievements: Array.isArray(userData.unlockedAchievements)
            ? userData.unlockedAchievements.filter((v: unknown): v is string => typeof v === 'string')
            : [],
          equippedBadges: Array.isArray(userData.equippedBadges)
            ? userData.equippedBadges.filter((v: unknown): v is string => typeof v === 'string')
            : [],
          totalEpisodesCompleted: userEpisodes,
          totalWatchSeconds: userWatchSecs,
          todayWatchSeconds: userTodaySecs,
          weeklyWatchSeconds: Math.max(userWeeklySecs, userTodaySecs),
          monthlyWatchSeconds: Math.max(userMonthlySecs, userWeeklySecs),
          streakCurrent: Number(userData.streakCurrent || 0),
          streakLongest: Number(userData.streakLongest || 0),
          history: combinedHistory,
          dailyActivity,
        } satisfies UserAnalyticsSummary;
      })
    );

    for (const userSummary of batchResults) {
      users.push(userSummary);

      totalWatchTimeSeconds += userSummary.totalWatchSeconds;
      todayWatchTimeSeconds += userSummary.todayWatchSeconds;
      weeklyWatchTimeSeconds += userSummary.weeklyWatchSeconds;
      monthlyWatchTimeSeconds += userSummary.monthlyWatchSeconds;
      totalEpisodesWatched += Math.max(userSummary.totalEpisodesCompleted, userSummary.history.length);
      totalWatchSessions += userSummary.history.length;

      for (const [dateStr, secs] of Object.entries(userSummary.dailyActivity)) {
        dailyTrendMap[dateStr] = (dailyTrendMap[dateStr] || 0) + secs;
      }

      for (const entry of userSummary.history) {
        if (entry.title) {
          const key = entry.title.trim();
          if (!animeFrequencyMap[key]) {
            animeFrequencyMap[key] = {
              title: key,
              count: 0,
              totalSeconds: 0,
              animeId: entry.animeId || 0,
            };
          }
          animeFrequencyMap[key].count += 1;
          animeFrequencyMap[key].totalSeconds += entry.watchedSeconds || 0;
        }

        const srv = normalizeServerDisplayName(entry.serverName, entry.audioMode);
        if (!serverFrequencyMap[srv]) {
          serverFrequencyMap[srv] = { count: 0, totalSeconds: 0 };
        }
        serverFrequencyMap[srv].count += 1;
        serverFrequencyMap[srv].totalSeconds += entry.watchedSeconds || 0;

        recentWatchSessions.push({
          ...entry,
          userId: userSummary.uid,
          userName: userSummary.displayName,
          userEmail: userSummary.email,
          userAvatar: userSummary.photoURL,
        });
      }
    }
  }

  recentWatchSessions.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));

  const mostActiveUsers = [...users]
    .filter((u) => u.totalWatchSeconds > 0 || u.history.length > 0)
    .sort((a, b) => b.totalWatchSeconds - a.totalWatchSeconds);

  const mostWatchedAnime = Object.values(animeFrequencyMap)
    .sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds)
    .slice(0, 10);

  const popularServers = Object.entries(serverFrequencyMap)
    .map(([serverName, stats]) => ({
      serverName,
      count: stats.count,
      totalSeconds: stats.totalSeconds,
    }))
    .sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds);

  const dailyWatchTrend = Object.entries(dailyTrendMap)
    .map(([date, seconds]) => ({ date, seconds }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);

  return {
    users,
    activeSessions: [],
    recentWatchSessions: recentWatchSessions.slice(0, 20),
    totalWatchTimeSeconds,
    todayWatchTimeSeconds,
    weeklyWatchTimeSeconds,
    monthlyWatchTimeSeconds,
    totalEpisodesWatched,
    totalWatchSessions,
    mostWatchedAnime,
    mostActiveUsers,
    popularServers,
    dailyWatchTrend,
  };
}

export function exportAnalyticsCsv(users: UserAnalyticsSummary[]): void {
  const headers = [
    'User ID',
    'Name',
    'Email',
    'Today Watch (mins)',
    'Weekly Watch (mins)',
    'Monthly Watch (mins)',
    'Lifetime Watch (hours)',
    'Episodes Completed',
    'Watch Sessions',
    'Last Watched Anime',
    'Last Server',
    'Current Streak',
    'Last Active',
  ];
  const rows = users.map((u) => {
    const lastHist = u.history[0];
    return [
      u.uid,
      `"${(u.displayName || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      Math.round(u.todayWatchSeconds / 60),
      Math.round(u.weeklyWatchSeconds / 60),
      Math.round(u.monthlyWatchSeconds / 60),
      (u.totalWatchSeconds / 3600).toFixed(2),
      u.totalEpisodesCompleted,
      u.history.length,
      `"${(lastHist ? `${lastHist.title} (Ep ${lastHist.episodeNumber})` : 'None').replace(/"/g, '""')}"`,
      `"${(lastHist ? normalizeServerDisplayName(lastHist.serverName, lastHist.audioMode) : 'N/A').replace(/"/g, '""')}"`,
      u.streakCurrent,
      u.lastActiveAt ? new Date(toMillis(u.lastActiveAt)).toISOString() : 'N/A',
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `flix4u_watch_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
