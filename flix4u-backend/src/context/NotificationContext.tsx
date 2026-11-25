import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  DEFAULT_ENABLED_CATEGORIES,
  deleteSingleNotification,
  ensureAppUpdatePersonalNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  mergeUserNotifications,
  subscribeGlobalNotificationsForUser,
  subscribeNotificationCategorySettings,
  subscribeUserNotificationStates,
  subscribeUserPersonalNotifications,
  syncFollowedAnimeEpisodeNotifications,
} from '@/src/services/notificationService';
import {
  CURRENT_CLIENT_VERSION_CODE,
  subscribeAppUpdateConfig,
} from '@/src/services/updateService';
import type {
  GlobalNotificationRecord,
  MergedCalendarEvent,
  NotificationCategorySettings,
  UnifiedNotificationItem,
  UserNotificationStateRecord,
  UserPersonalNotification,
} from '@/src/types/anime';

interface NotificationContextValue {
  notifications: UnifiedNotificationItem[];
  unreadCount: number;
  loading: boolean;
  categorySettings: NotificationCategorySettings;
  markRead: (item: UnifiedNotificationItem) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotification: (item: UnifiedNotificationItem) => Promise<void>;
  syncCalendarAlerts: (events: MergedCalendarEvent[]) => Promise<void>;
}

const DEFAULT_SETTINGS: NotificationCategorySettings = {
  id: 'global',
  enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
  updatedBy: 'system',
  updatedAt: 0,
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady, watchlist } = useAuth();
  const verifiedUid = authReady && user && user.emailVerified ? user.uid : '';

  const [categorySettings, setCategorySettings] =
    useState<NotificationCategorySettings>(DEFAULT_SETTINGS);
  const [globalItems, setGlobalItems] = useState<GlobalNotificationRecord[]>([]);
  const [personalItems, setPersonalItems] = useState<UserPersonalNotification[]>([]);
  const [stateMap, setStateMap] = useState<Record<string, UserNotificationStateRecord>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [personalLoaded, setPersonalLoaded] = useState<boolean>(false);

  const syncedUpdateVersionsRef = useRef<Set<string>>(new Set());
  const syncedCalendarKeysRef = useRef<Set<string>>(new Set());

  // Reset per-user local caches on uid change
  useEffect(() => {
    syncedUpdateVersionsRef.current.clear();
    syncedCalendarKeysRef.current.clear();
    if (!verifiedUid) {
      setGlobalItems([]);
      setPersonalItems([]);
      setStateMap({});
      setPersonalLoaded(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPersonalLoaded(false);
  }, [verifiedUid]);

  // Global notification settings subscription (always available to verified users)
  useEffect(() => {
    if (!verifiedUid) {
      setCategorySettings(DEFAULT_SETTINGS);
      return;
    }
    const unsub = subscribeNotificationCategorySettings((settings) => {
      setCategorySettings(settings);
    });
    return () => unsub();
  }, [verifiedUid]);

  // Real-time global announcements, personal notifications & per-user state subscriptions
  useEffect(() => {
    if (!verifiedUid) return;

    let gotGlobal = false;
    let gotPersonal = false;
    let gotStates = false;

    const markReadyIfAllLoaded = () => {
      if (gotGlobal && gotPersonal && gotStates) {
        setLoading(false);
      }
    };

    const unsubGlobal = subscribeGlobalNotificationsForUser(verifiedUid, (items) => {
      setGlobalItems(items);
      gotGlobal = true;
      markReadyIfAllLoaded();
    });

    const unsubPersonal = subscribeUserPersonalNotifications(verifiedUid, (items) => {
      setPersonalItems(items);
      setPersonalLoaded(true);
      gotPersonal = true;
      markReadyIfAllLoaded();
    });

    const unsubStates = subscribeUserNotificationStates(verifiedUid, (nextStates) => {
      setStateMap(nextStates);
      gotStates = true;
      markReadyIfAllLoaded();
    });

    const fallbackTimer = window.setTimeout(() => {
      setLoading(false);
    }, 2500);

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubGlobal();
      unsubPersonal();
      unsubStates();
    };
  }, [verifiedUid]);

  const personalIdSet = useMemo(() => {
    return new Set(personalItems.map((p) => p.id));
  }, [personalItems]);

  // Auto-sync app update notifications when an active newer APK update is configured
  useEffect(() => {
    if (!verifiedUid || !personalLoaded) return;
    if (categorySettings.enabledCategories.app_update === false) return;

    const unsub = subscribeAppUpdateConfig((cfg) => {
      if (!cfg.enabled || cfg.versionCode <= CURRENT_CLIENT_VERSION_CODE) return;
      const versionKey = `${cfg.latestVersion}:${cfg.versionCode}`;
      if (syncedUpdateVersionsRef.current.has(versionKey)) return;
      syncedUpdateVersionsRef.current.add(versionKey);

      const safeVer = cfg.latestVersion.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const expectedId = `app_update_${safeVer}`;
      if (personalIdSet.has(expectedId)) return;

      void ensureAppUpdatePersonalNotification(
        verifiedUid,
        cfg.latestVersion,
        cfg.title,
        cfg.description || `Flix4U ${cfg.latestVersion} is now available for download.`,
        personalIdSet
      );
    });

    return () => unsub();
  }, [verifiedUid, personalLoaded, categorySettings.enabledCategories.app_update, personalIdSet]);

  const notifications = useMemo(() => {
    return mergeUserNotifications(globalItems, personalItems, stateMap, categorySettings);
  }, [globalItems, personalItems, stateMap, categorySettings]);

  const unreadCount = useMemo(() => {
    return notifications.reduce((count, item) => (item.read ? count : count + 1), 0);
  }, [notifications]);

  const markRead = useCallback(
    async (item: UnifiedNotificationItem) => {
      if (!verifiedUid || item.read) return;
      await markNotificationAsRead(verifiedUid, item);
    },
    [verifiedUid]
  );

  const markAllRead = useCallback(async () => {
    if (!verifiedUid) return;
    await markAllNotificationsAsRead(verifiedUid, notifications);
  }, [verifiedUid, notifications]);

  const removeNotification = useCallback(
    async (item: UnifiedNotificationItem) => {
      if (!verifiedUid) return;
      await deleteSingleNotification(verifiedUid, item);
    },
    [verifiedUid]
  );

  const syncCalendarAlerts = useCallback(
    async (events: MergedCalendarEvent[]) => {
      if (!verifiedUid || !personalLoaded || events.length === 0 || watchlist.length === 0) {
        return;
      }
      if (categorySettings.enabledCategories.new_episode === false) {
        return;
      }

      const unseenIds = new Set(personalIdSet);
      const pendingEvents: MergedCalendarEvent[] = [];
      for (const ev of events) {
        if (!ev.animeId) continue;
        const notifId = `ep_${ev.animeId}_${ev.episodeNumber}`;
        if (unseenIds.has(notifId) || syncedCalendarKeysRef.current.has(notifId)) continue;
        syncedCalendarKeysRef.current.add(notifId);
        pendingEvents.push(ev);
      }

      if (pendingEvents.length === 0) return;

      await syncFollowedAnimeEpisodeNotifications(
        verifiedUid,
        watchlist,
        pendingEvents,
        unseenIds
      );
    },
    [verifiedUid, personalLoaded, watchlist, personalIdSet, categorySettings.enabledCategories.new_episode]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      categorySettings,
      markRead,
      markAllRead,
      removeNotification,
      syncCalendarAlerts,
    }),
    [
      notifications,
      unreadCount,
      loading,
      categorySettings,
      markRead,
      markAllRead,
      removeNotification,
      syncCalendarAlerts,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used inside NotificationProvider.');
  }
  return ctx;
}
