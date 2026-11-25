import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { resolveApiUrl } from '@/src/config/env';
import { db, logFirestoreError, OperationType } from '@/src/lib/firebase';
import type { XpActionType, XpHistoryItem, XpLevelInfo } from '@/src/types/anime';

export const XP_DAILY_GOAL_SECONDS = 900; // 15 minutes of verified playback per day

export const XP_REWARDS_CONFIG = {
  first_episode: 20,
  episode_complete: 10,
  daily_goal: 15,
  daily_login: 5,
  streak_milestones: {
    3: 25,
    7: 50,
    15: 100,
    30: 200,
    100: 500,
  } as Record<number, number>,
};

export interface XpRankTier {
  minLevel: number;
  title: string;
  accentHex: string;
  secondaryHex: string;
  badgeText: string;
}

export const XP_RANK_TIERS: XpRankTier[] = [
  { minLevel: 1, title: 'Beginner', accentHex: '#94a3b8', secondaryHex: '#cbd5e1', badgeText: 'Lv 1+' },
  { minLevel: 5, title: 'Anime Fan', accentHex: '#38bdf8', secondaryHex: '#818cf8', badgeText: 'Lv 5+' },
  { minLevel: 10, title: 'Otaku', accentHex: '#a855f7', secondaryHex: '#e879f9', badgeText: 'Lv 10+' },
  { minLevel: 20, title: 'Anime Master', accentHex: '#f97316', secondaryHex: '#facc15', badgeText: 'Lv 20+' },
  { minLevel: 30, title: 'Anime Legend', accentHex: '#ec4899', secondaryHex: '#f43f5e', badgeText: 'Lv 30+' },
  { minLevel: 50, title: 'Flix4U Elite', accentHex: '#22d3ee', secondaryHex: '#a855f7', badgeText: 'Lv 50+' },
];

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l += 1) {
    total += Math.round(35 + 15 * (l - 2) + 0.65 * Math.pow(l - 2, 2));
  }
  return total;
}

export function getLevelTier(level: number): XpRankTier {
  let matched = XP_RANK_TIERS[0];
  for (const tier of XP_RANK_TIERS) {
    if (level >= tier.minLevel) {
      matched = tier;
    }
  }
  return matched;
}

export function getLevelTitle(level: number): string {
  return getLevelTier(level).title;
}

export function computeLevelFromXp(xp: number, isAdmin = false): XpLevelInfo {
  if (isAdmin) {
    const eliteFloor = xpRequiredForLevel(50);
    return {
      level: 50,
      title: 'Flix4U Elite',
      totalXp: Math.max(eliteFloor, Math.floor(xp || 0)),
      currentLevelFloorXp: eliteFloor,
      nextLevelXp: eliteFloor,
      xpIntoLevel: 100,
      xpNeededForNext: 100,
      progressPercent: 100,
      isMaxRank: true,
      isUnlimitedAdmin: true,
    };
  }

  const safeXp = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  while (level < 99 && safeXp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }

  const currentFloor = xpRequiredForLevel(level);
  const nextFloor = level >= 99 ? currentFloor : xpRequiredForLevel(level + 1);
  const span = Math.max(1, nextFloor - currentFloor);
  const into = Math.max(0, safeXp - currentFloor);
  const pct = level >= 99 ? 100 : Math.min(100, Math.max(0, Math.round((into / span) * 100)));

  return {
    level,
    title: getLevelTitle(level),
    totalXp: safeXp,
    currentLevelFloorXp: currentFloor,
    nextLevelXp: nextFloor,
    xpIntoLevel: into,
    xpNeededForNext: span,
    progressPercent: pct,
    isMaxRank: level >= 50,
    isUnlimitedAdmin: false,
  };
}

function toMillis(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  return Date.now();
}

function makeSafeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128) || `xp_${Date.now()}`;
}

export interface ClaimXpParams {
  uid: string;
  idToken: string;
  actionType: XpActionType;
  eventKey: string;
  currentTotalXp: number;
  watchedSeconds?: number;
  durationSeconds?: number;
  progressSeconds?: number;
  todayWatchSeconds?: number;
  streakDays?: number;
  milestoneDays?: number;
  animeTitle?: string;
  episodeNumber?: number;
  todayKey?: string;
  awardedMilestones?: number[];
}

export interface ClaimXpResponse {
  awarded: boolean;
  xpDelta: number;
  nextTotalXp: number;
  prevLevel: number;
  nextLevel: number;
  levelTitle: string;
  leveledUp: boolean;
  reason?: string;
  eventKey: string;
}

export async function claimAndPersistVerifiedXp(params: ClaimXpParams): Promise<ClaimXpResponse | null> {
  if (!db || !params.uid || !params.idToken) return null;

  const safeEventKey = makeSafeDocId(params.eventKey);

  try {
    const res = await fetch(resolveApiUrl('/api/xp/award'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.idToken}`,
      },
      body: JSON.stringify({
        actionType: params.actionType,
        eventKey: safeEventKey,
        currentTotalXp: params.currentTotalXp,
        watchedSeconds: params.watchedSeconds ?? 0,
        durationSeconds: params.durationSeconds ?? 0,
        progressSeconds: params.progressSeconds ?? 0,
        todayWatchSeconds: params.todayWatchSeconds ?? 0,
        streakDays: params.streakDays ?? 0,
        milestoneDays: params.milestoneDays ?? 0,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as {
      ok?: boolean;
      awarded?: boolean;
      duplicate?: boolean;
      xpDelta?: number;
      nextTotalXp?: number;
      level?: number;
      levelTitle?: string;
      leveledUp?: boolean;
      reason?: string;
    };

    if (!json.ok || !json.awarded || !json.xpDelta || json.xpDelta <= 0) {
      return null;
    }

    const prevInfo = computeLevelFromXp(params.currentTotalXp, false);
    const nextTotalXp = Math.max(params.currentTotalXp + json.xpDelta, Number(json.nextTotalXp || 0));
    const nextInfo = computeLevelFromXp(nextTotalXp, false);

    const historyDocId = safeEventKey;
    const historyRef = doc(db, `users/${params.uid}/xpHistory/${historyDocId}`);
    const historyPayload: Record<string, unknown> = {
      id: historyDocId,
      ownerId: params.uid,
      eventKey: safeEventKey,
      actionType: params.actionType,
      xpDelta: json.xpDelta,
      reason: (json.reason || 'Activity XP reward').slice(0, 200),
      levelAfter: nextInfo.level,
      createdAt: serverTimestamp(),
    };
    if (params.animeTitle && params.animeTitle.trim()) {
      historyPayload.animeTitle = params.animeTitle.trim().slice(0, 240);
    }
    if (typeof params.episodeNumber === 'number' && params.episodeNumber >= 0) {
      historyPayload.episodeNumber = Math.round(params.episodeNumber);
    }

    // Write idempotent history entry (if doc already exists, update returns error because update: false -> deduplicated!)
    try {
      await setDoc(historyRef, historyPayload);
    } catch (histErr) {
      // If history doc already existed (duplicate replay), do not increment user XP again
      logFirestoreError(histErr, OperationType.CREATE, `users/${params.uid}/xpHistory/${historyDocId}`);
      return null;
    }

    const userUpdatePayload: Record<string, unknown> = {
      xp: nextTotalXp,
      level: nextInfo.level,
      xpUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (params.actionType === 'daily_login' && params.todayKey) {
      userUpdatePayload.lastLoginXpDay = params.todayKey;
    }
    if (params.actionType === 'daily_goal' && params.todayKey) {
      userUpdatePayload.lastGoalXpDay = params.todayKey;
    }
    if (params.actionType === 'streak_milestone' && params.milestoneDays) {
      const nextMilestones = Array.from(
        new Set([...(params.awardedMilestones || []), params.milestoneDays])
      ).slice(0, 10);
      userUpdatePayload.xpStreakMilestones = nextMilestones;
    }

    await updateDoc(doc(db, `users/${params.uid}`), userUpdatePayload);

    return {
      awarded: true,
      xpDelta: json.xpDelta,
      nextTotalXp,
      prevLevel: prevInfo.level,
      nextLevel: nextInfo.level,
      levelTitle: nextInfo.title,
      leveledUp: nextInfo.level > prevInfo.level,
      reason: json.reason,
      eventKey: safeEventKey,
    };
  } catch (err) {
    console.warn('[XP Service] Failed to claim verified XP reward:', err);
    return null;
  }
}

export function subscribeXpHistory(
  uid: string,
  callback: (items: XpHistoryItem[]) => void
): () => void {
  if (!db || !uid) {
    callback([]);
    return () => {};
  }

  const path = `users/${uid}/xpHistory`;
  const q = query(
    collection(db, path),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: XpHistoryItem[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: dSnap.id,
          ownerId: String(d.ownerId || uid),
          eventKey: String(d.eventKey || dSnap.id),
          actionType: (d.actionType || 'episode_complete') as XpActionType,
          xpDelta: Math.max(1, Number(d.xpDelta || 0)),
          reason: String(d.reason || 'XP Reward'),
          animeTitle: typeof d.animeTitle === 'string' ? d.animeTitle : undefined,
          episodeNumber: typeof d.episodeNumber === 'number' ? d.episodeNumber : undefined,
          levelAfter: Math.max(1, Number(d.levelAfter || 1)),
          createdAt: toMillis(d.createdAt),
        };
      });
      items.sort((a, b) => b.createdAt - a.createdAt);
      callback(items);
    },
    (err) => {
      logFirestoreError(err, OperationType.LIST, path);
      callback([]);
    }
  );
}
