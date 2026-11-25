import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from '@/src/lib/firebase';
import type {
  GlobalNotificationRecord,
  LibraryAnimeItem,
  MergedCalendarEvent,
  NotificationCategory,
  NotificationCategorySettings,
  NotificationTargetType,
  UnifiedNotificationItem,
  UserNotificationStateRecord,
  UserPersonalNotification,
} from '@/src/types/anime';

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  new_episode: 'New Anime Episode',
  new_release: 'New Anime Release',
  app_update: 'App Update Available',
  admin_announcement: 'Admin Announcements',
  maintenance: 'Maintenance Notifications',
  service_alert: 'Important Service Alerts',
};

export const ALL_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'new_episode',
  'new_release',
  'app_update',
  'admin_announcement',
  'maintenance',
  'service_alert',
];

export const DEFAULT_ENABLED_CATEGORIES: Record<NotificationCategory, boolean> = {
  new_episode: true,
  new_release: true,
  app_update: true,
  admin_announcement: true,
  maintenance: true,
  service_alert: true,
};

function toMillis(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return Date.now();
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

export function isNotificationScheduleActive(item: GlobalNotificationRecord, now = Date.now()): boolean {
  if (!item.enabled) return false;
  if (item.startAt) {
    const startMs = Date.parse(item.startAt);
    if (!Number.isNaN(startMs) && now < startMs) return false;
  }
  if (item.expiresAt) {
    const endMs = Date.parse(item.expiresAt);
    if (!Number.isNaN(endMs) && now > endMs) return false;
  }
  return true;
}

export function subscribeNotificationCategorySettings(
  callback: (settings: NotificationCategorySettings) => void
): () => void {
  const fallback: NotificationCategorySettings = {
    id: 'global',
    enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
    updatedBy: 'system',
    updatedAt: 0,
  };
  if (!db) {
    callback(fallback);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'notification_settings', 'global'),
    (snap) => {
      if (!snap.exists()) {
        callback(fallback);
        return;
      }
      const d = snap.data();
      const rawMap = (d.enabledCategories || {}) as Record<string, unknown>;
      const merged: Record<NotificationCategory, boolean> = { ...DEFAULT_ENABLED_CATEGORIES };
      for (const cat of ALL_NOTIFICATION_CATEGORIES) {
        if (typeof rawMap[cat] === 'boolean') {
          merged[cat] = rawMap[cat] as boolean;
        }
      }
      callback({
        id: 'global',
        enabledCategories: merged,
        updatedBy: String(d.updatedBy || 'admin'),
        updatedAt: toMillis(d.updatedAt),
      });
    },
    (err) => {
      logFirestoreError(err, OperationType.GET, 'notification_settings/global');
      callback(fallback);
    }
  );
}

export async function updateNotificationCategorySettings(
  adminUid: string,
  enabledCategories: Record<NotificationCategory, boolean>
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await setDoc(doc(db, 'notification_settings', 'global'), {
    id: 'global',
    enabledCategories,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

function mapGlobalDoc(id: string, d: Record<string, unknown>): GlobalNotificationRecord {
  return {
    id,
    category: (d.category || 'admin_announcement') as NotificationCategory,
    title: String(d.title || 'Announcement'),
    message: String(d.message || ''),
    targetType: d.targetType === 'selected' ? 'selected' : 'all',
    targetUserIds: Array.isArray(d.targetUserIds)
      ? d.targetUserIds.filter((v): v is string => typeof v === 'string')
      : [],
    actionUrl: typeof d.actionUrl === 'string' && d.actionUrl.trim() ? d.actionUrl.trim() : undefined,
    animeId: typeof d.animeId === 'number' ? d.animeId : undefined,
    enabled: Boolean(d.enabled),
    startAt: typeof d.startAt === 'string' && d.startAt.trim() ? d.startAt.trim() : undefined,
    expiresAt: typeof d.expiresAt === 'string' && d.expiresAt.trim() ? d.expiresAt.trim() : undefined,
    createdBy: String(d.createdBy || ''),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

export function subscribeGlobalNotificationsForUser(
  uid: string,
  callback: (items: GlobalNotificationRecord[]) => void
): () => void {
  if (!db || !uid) {
    callback([]);
    return () => {};
  }

  let allList: GlobalNotificationRecord[] = [];
  let targetedList: GlobalNotificationRecord[] = [];

  const emit = () => {
    const map = new Map<string, GlobalNotificationRecord>();
    [...allList, ...targetedList].forEach((n) => map.set(n.id, n));
    const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
    callback(merged);
  };

  const unsubAll = onSnapshot(
    query(collection(db, 'notifications'), where('targetType', '==', 'all')),
    (snap) => {
      allList = snap.docs.map((d) => mapGlobalDoc(d.id, d.data()));
      emit();
    },
    (err) => logFirestoreError(err, OperationType.LIST, 'notifications[all]')
  );

  const unsubTargeted = onSnapshot(
    query(collection(db, 'notifications'), where('targetUserIds', 'array-contains', uid)),
    (snap) => {
      targetedList = snap.docs.map((d) => mapGlobalDoc(d.id, d.data()));
      emit();
    },
    (err) => logFirestoreError(err, OperationType.LIST, 'notifications[selected]')
  );

  return () => {
    unsubAll();
    unsubTargeted();
  };
}

export function subscribeAllGlobalNotificationsForAdmin(
  callback: (items: GlobalNotificationRecord[]) => void,
  onError?: (msg: string) => void
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'notifications'),
    (snap) => {
      const list = snap.docs
        .map((d) => mapGlobalDoc(d.id, d.data()))
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => {
      logFirestoreError(err, OperationType.LIST, 'notifications[admin]');
      if (onError) onError(err instanceof Error ? err.message : 'Unable to load announcements.');
      callback([]);
    }
  );
}

export function subscribeUserPersonalNotifications(
  uid: string,
  callback: (items: UserPersonalNotification[]) => void
): () => void {
  if (!db || !uid) {
    callback([]);
    return () => {};
  }
  const path = `users/${uid}/notifications`;
  return onSnapshot(
    query(collection(db, path), where('ownerId', '==', uid)),
    (snap) => {
      const list: UserPersonalNotification[] = snap.docs
        .map((dSnap) => {
          const d = dSnap.data();
          return {
            id: dSnap.id,
            ownerId: String(d.ownerId || uid),
            category: (d.category || 'new_episode') as NotificationCategory,
            title: String(d.title || 'Notification'),
            message: String(d.message || ''),
            read: Boolean(d.read),
            actionUrl: typeof d.actionUrl === 'string' ? d.actionUrl : undefined,
            animeId: typeof d.animeId === 'number' ? d.animeId : undefined,
            episodeNumber: typeof d.episodeNumber === 'number' ? d.episodeNumber : undefined,
            createdAt: toMillis(d.createdAt),
            updatedAt: toMillis(d.updatedAt),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => {
      logFirestoreError(err, OperationType.LIST, path);
      callback([]);
    }
  );
}

export function subscribeUserNotificationStates(
  uid: string,
  callback: (stateMap: Record<string, UserNotificationStateRecord>) => void
): () => void {
  if (!db || !uid) {
    callback({});
    return () => {};
  }
  const path = `users/${uid}/notificationStates`;
  return onSnapshot(
    query(collection(db, path), where('ownerId', '==', uid)),
    (snap) => {
      const next: Record<string, UserNotificationStateRecord> = {};
      snap.docs.forEach((dSnap) => {
        const d = dSnap.data();
        next[dSnap.id] = {
          id: dSnap.id,
          ownerId: String(d.ownerId || uid),
          notificationId: String(d.notificationId || dSnap.id),
          read: Boolean(d.read),
          deleted: Boolean(d.deleted),
          updatedAt: toMillis(d.updatedAt),
        };
      });
      callback(next);
    },
    (err) => {
      logFirestoreError(err, OperationType.LIST, path);
      callback({});
    }
  );
}

export function mergeUserNotifications(
  globalItems: GlobalNotificationRecord[],
  personalItems: UserPersonalNotification[],
  stateMap: Record<string, UserNotificationStateRecord>,
  settings: NotificationCategorySettings | null
): UnifiedNotificationItem[] {
  const now = Date.now();
  const enabledCats = settings?.enabledCategories || DEFAULT_ENABLED_CATEGORIES;
  const merged: UnifiedNotificationItem[] = [];

  for (const g of globalItems) {
    if (!isNotificationScheduleActive(g, now)) continue;
    if (enabledCats[g.category] === false) continue;
    const state = stateMap[g.id];
    if (state?.deleted) continue;
    merged.push({
      id: g.id,
      source: 'global',
      category: g.category,
      title: g.title,
      message: g.message,
      read: Boolean(state?.read),
      actionUrl: g.actionUrl,
      animeId: g.animeId,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    });
  }

  for (const p of personalItems) {
    if (enabledCats[p.category] === false) continue;
    merged.push({
      id: p.id,
      source: 'personal',
      category: p.category,
      title: p.title,
      message: p.message,
      read: p.read,
      actionUrl: p.actionUrl,
      animeId: p.animeId,
      episodeNumber: p.episodeNumber,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  merged.sort((a, b) => b.createdAt - a.createdAt);
  return merged;
}

export async function markNotificationAsRead(
  uid: string,
  item: UnifiedNotificationItem
): Promise<void> {
  if (!db || !uid || item.read) return;
  if (item.source === 'personal') {
    await updateDoc(doc(db, `users/${uid}/notifications/${item.id}`), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(doc(db, `users/${uid}/notificationStates/${item.id}`), {
      id: item.id,
      ownerId: uid,
      notificationId: item.id,
      read: true,
      deleted: false,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function markAllNotificationsAsRead(
  uid: string,
  items: UnifiedNotificationItem[]
): Promise<void> {
  if (!db || !uid) return;
  const unread = items.filter((i) => !i.read).slice(0, 450);
  if (unread.length === 0) return;

  const batch = writeBatch(db);
  for (const item of unread) {
    if (item.source === 'personal') {
      batch.update(doc(db!, `users/${uid}/notifications/${item.id}`), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(doc(db!, `users/${uid}/notificationStates/${item.id}`), {
        id: item.id,
        ownerId: uid,
        notificationId: item.id,
        read: true,
        deleted: false,
        updatedAt: serverTimestamp(),
      });
    }
  }
  await batch.commit();
}

export async function deleteSingleNotification(
  uid: string,
  item: UnifiedNotificationItem
): Promise<void> {
  if (!db || !uid) return;
  if (item.source === 'personal') {
    await deleteDoc(doc(db, `users/${uid}/notifications/${item.id}`));
  } else {
    await setDoc(doc(db, `users/${uid}/notificationStates/${item.id}`), {
      id: item.id,
      ownerId: uid,
      notificationId: item.id,
      read: true,
      deleted: true,
      updatedAt: serverTimestamp(),
    });
  }
}

export interface AdminAnnouncementInput {
  category: NotificationCategory;
  title: string;
  message: string;
  targetType: NotificationTargetType;
  targetUserIds: string[];
  actionUrl?: string;
  animeId?: number;
  enabled: boolean;
  startAt?: string;
  expiresAt?: string;
}

export async function createAnnouncementNotification(
  adminUid: string,
  input: AdminAnnouncementInput
): Promise<string> {
  if (!db) throw new Error('Firestore is not initialized.');
  const id = makeDocId('notif');
  const payload: Record<string, unknown> = {
    id,
    category: input.category,
    title: input.title.trim().slice(0, 160),
    message: input.message.trim().slice(0, 1200),
    targetType: input.targetType,
    targetUserIds:
      input.targetType === 'selected'
        ? Array.from(new Set(input.targetUserIds)).slice(0, 100)
        : [],
    enabled: Boolean(input.enabled),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.actionUrl && input.actionUrl.trim()) {
    payload.actionUrl = input.actionUrl.trim().slice(0, 500);
  }
  if (typeof input.animeId === 'number' && input.animeId >= 0) {
    payload.animeId = Math.round(input.animeId);
  }
  if (input.startAt && input.startAt.trim()) {
    payload.startAt = input.startAt.trim().slice(0, 40);
  }
  if (input.expiresAt && input.expiresAt.trim()) {
    payload.expiresAt = input.expiresAt.trim().slice(0, 40);
  }

  await setDoc(doc(db, 'notifications', id), payload);
  return id;
}

export async function updateAnnouncementNotification(
  notifId: string,
  input: Partial<AdminAnnouncementInput>
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (input.category) payload.category = input.category;
  if (typeof input.title === 'string') payload.title = input.title.trim().slice(0, 160);
  if (typeof input.message === 'string') payload.message = input.message.trim().slice(0, 1200);
  if (input.targetType) {
    payload.targetType = input.targetType;
    payload.targetUserIds =
      input.targetType === 'selected' && Array.isArray(input.targetUserIds)
        ? Array.from(new Set(input.targetUserIds)).slice(0, 100)
        : [];
  } else if (Array.isArray(input.targetUserIds)) {
    payload.targetUserIds = Array.from(new Set(input.targetUserIds)).slice(0, 100);
  }
  if (typeof input.enabled === 'boolean') payload.enabled = input.enabled;
  if (typeof input.actionUrl === 'string') payload.actionUrl = input.actionUrl.trim().slice(0, 500);
  if (typeof input.startAt === 'string') payload.startAt = input.startAt.trim().slice(0, 40);
  if (typeof input.expiresAt === 'string') payload.expiresAt = input.expiresAt.trim().slice(0, 40);

  await updateDoc(doc(db, 'notifications', notifId), payload);
}

export async function deleteAnnouncementNotification(notifId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await deleteDoc(doc(db, 'notifications', notifId));
}

export interface TargetableUserOption {
  uid: string;
  displayName: string;
  email?: string;
}

export async function fetchUsersForNotificationTargeting(): Promise<TargetableUserOption[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((dSnap) => {
      const d = dSnap.data();
      return {
        uid: dSnap.id,
        displayName: String(d.displayName || 'Anonymous User'),
        email: typeof d.email === 'string' ? d.email : undefined,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Deduplicated followed-anime new episode notifications.
 * Uses deterministic doc IDs (ep_<animeId>_<ep>) so notifications never duplicate across reloads.
 */
export async function syncFollowedAnimeEpisodeNotifications(
  uid: string,
  watchlist: LibraryAnimeItem[],
  calendarEvents: MergedCalendarEvent[],
  existingPersonalIds: Set<string>
): Promise<void> {
  if (!db || !uid || watchlist.length === 0 || calendarEvents.length === 0) return;

  const watchedIds = new Set(watchlist.map((w) => w.animeId));
  const now = Date.now();
  const threeDaysAgo = now - 3 * 86400_000;
  const oneDayAhead = now + 86400_000;

  for (const ev of calendarEvents) {
    if (!ev.animeId || !watchedIds.has(ev.animeId)) continue;
    if (ev.status === 'delayed') continue;
    if (ev.releaseAtMs < threeDaysAgo || ev.releaseAtMs > oneDayAhead) continue;

    const notifId = `ep_${ev.animeId}_${ev.episodeNumber}`;
    if (existingPersonalIds.has(notifId)) continue;

    const isAlreadyOut = ev.status === 'released' || ev.releaseAtMs <= now;
    const title = isAlreadyOut
      ? `New Episode Released: ${ev.title}`
      : `Episode Releasing Soon: ${ev.title}`;
    const releaseStr = new Date(ev.releaseAtMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const message = isAlreadyOut
      ? `Episode ${ev.episodeNumber} of ${ev.title} (on your Watchlist) is now available!`
      : `Episode ${ev.episodeNumber} of ${ev.title} releases at ${releaseStr}.`;

    try {
      await setDoc(doc(db, `users/${uid}/notifications/${notifId}`), {
        id: notifId,
        ownerId: uid,
        category: 'new_episode',
        title: title.slice(0, 160),
        message: message.slice(0, 1200),
        read: false,
        actionUrl: `/anime/${ev.animeId}`,
        animeId: ev.animeId,
        episodeNumber: ev.episodeNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore concurrent write conflicts or duplicate id attempts
    }
  }
}

export async function ensureAppUpdatePersonalNotification(
  uid: string,
  latestVersion: string,
  title: string,
  description: string,
  existingPersonalIds: Set<string>
): Promise<void> {
  if (!db || !uid || !latestVersion) return;
  const safeVer = latestVersion.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const notifId = `app_update_${safeVer}`;
  if (existingPersonalIds.has(notifId)) return;

  try {
    await setDoc(doc(db, `users/${uid}/notifications/${notifId}`), {
      id: notifId,
      ownerId: uid,
      category: 'app_update',
      title: (title || `Flix4U ${latestVersion} Available`).slice(0, 160),
      message: (description || `Version ${latestVersion} is ready to download.`).slice(0, 1200),
      read: false,
      actionUrl: '/settings',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}
