import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import {
  updateActiveWatchSession,
  clearActiveWatchSession,
  normalizeServerDisplayName,
  type ActiveSessionStatus,
} from '@/src/services/watchAnalyticsService';

interface WatchHeartbeatParams {
  animeId: number;
  animeTitle: string;
  episodeNumber: number;
  episodeTitle?: string;
  serverName: string;
}

export interface HeartbeatOptions {
  status?: ActiveSessionStatus | 'ended';
  sessionWatchedSeconds?: number;
}

export function useWatchSessionHeartbeat(params: WatchHeartbeatParams) {
  const { user, preferences } = useAuth();
  const lastHeartbeatMsRef = useRef(0);
  const lastStatusRef = useRef<ActiveSessionStatus | 'ended' | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const userNameRef = useRef(preferences.displayName);
  userNameRef.current = preferences.displayName;
  const userAvatarRef = useRef(preferences.photoURL);
  userAvatarRef.current = preferences.photoURL;

  const handleHeartbeat = useCallback(
    (curTime: number, durTime: number, isPlaying: boolean, options?: HeartbeatOptions) => {
      if (!user || !user.emailVerified) return;

      const resolvedStatus: ActiveSessionStatus | 'ended' =
        options?.status || (isPlaying ? 'playing' : 'paused');

      if (resolvedStatus === 'ended') {
        lastHeartbeatMsRef.current = 0;
        lastStatusRef.current = 'ended';
        void clearActiveWatchSession(user.uid);
        return;
      }

      const now = Date.now();
      const statusChanged = lastStatusRef.current !== resolvedStatus;

      // Immediate write on status change (e.g. playing -> paused or paused -> playing),
      // otherwise throttle periodic heartbeats to every 14 seconds.
      if (!statusChanged && lastHeartbeatMsRef.current > 0 && now - lastHeartbeatMsRef.current < 14000) {
        return;
      }

      lastHeartbeatMsRef.current = now;
      lastStatusRef.current = resolvedStatus;

      const safeTitle = (paramsRef.current.animeTitle || '').trim();
      const displayAnimeTitle =
        safeTitle && safeTitle !== 'Loading...' ? safeTitle : `Anime #${paramsRef.current.animeId || 1}`;

      void updateActiveWatchSession({
        id: user.uid,
        userId: user.uid,
        userName: userNameRef.current || user.displayName || 'Anime Fan',
        userEmail: user.email || undefined,
        userAvatar: userAvatarRef.current || user.photoURL || undefined,
        animeId: paramsRef.current.animeId,
        animeTitle: displayAnimeTitle,
        episodeNumber: paramsRef.current.episodeNumber,
        episodeTitle: paramsRef.current.episodeTitle || undefined,
        serverName: normalizeServerDisplayName(paramsRef.current.serverName),
        status: resolvedStatus,
        watchedSeconds: Math.max(0, Math.round(options?.sessionWatchedSeconds || 0)),
        progressSeconds: Math.max(0, Math.round(curTime || 0)),
        durationSeconds: Math.max(0, Math.round(durTime || 0)),
      });
    },
    [user]
  );

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    const handleUnload = () => {
      void clearActiveWatchSession(uid);
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      void clearActiveWatchSession(uid);
    };
  }, [user?.uid]);

  return { handleHeartbeat };
}
