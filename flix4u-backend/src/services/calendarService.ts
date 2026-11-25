import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getAnilistApiUrl } from '@/src/config/env';
import { db, logFirestoreError, OperationType } from '@/src/lib/firebase';
import { getDisplayTitle } from '@/src/services/anilistApi';
import type {
  AiringScheduleItem,
  CalendarEpisodeStatus,
  CalendarScheduleOverride,
  MergedCalendarEvent,
} from '@/src/types/anime';

const SUMMARY_FIELDS = `
  id
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  format
  status
  episodes
`;

interface ScheduleCacheEntry {
  expiresAt: number;
  items: AiringScheduleItem[];
}

const scheduleRangeCache = new Map<string, ScheduleCacheEntry>();

function toMillis(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  return Date.now();
}

export async function fetchAnilistScheduleWindow(
  startSec: number,
  endSec: number,
  maxPages = 3
): Promise<AiringScheduleItem[]> {
  const cacheKey = `${Math.floor(startSec / 3600)}:${Math.floor(endSec / 3600)}:${maxPages}`;
  const cached = scheduleRangeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const query = `
    query CalendarAiringSchedule($start: Int, $end: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo {
          hasNextPage
        }
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${SUMMARY_FIELDS}
          }
        }
      }
    }
  `;

  const collected: AiringScheduleItem[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetch(getAnilistApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          start: Math.floor(startSec),
          end: Math.floor(endSec),
          page,
        },
      }),
    });

    if (!res.ok) {
      if (collected.length > 0) break;
      throw new Error(`AniList schedule returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      data?: {
        Page?: {
          pageInfo?: { hasNextPage?: boolean };
          airingSchedules?: AiringScheduleItem[];
        };
      };
      errors?: Array<{ message?: string }>;
    };

    if (json.errors?.length && collected.length === 0) {
      throw new Error(json.errors[0]?.message || 'AniList schedule query failed.');
    }

    const pageItems = (json.data?.Page?.airingSchedules || []).filter(
      (item) => item.media && item.media.id
    );
    collected.push(...pageItems);

    if (!json.data?.Page?.pageInfo?.hasNextPage) {
      break;
    }
  }

  scheduleRangeCache.set(cacheKey, {
    expiresAt: Date.now() + 5 * 60 * 1000,
    items: collected,
  });

  return collected;
}

export function subscribeCalendarOverrides(
  callback: (entries: CalendarScheduleOverride[]) => void
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, 'calendar_entries'),
    (snap) => {
      const list: CalendarScheduleOverride[] = snap.docs.map((dSnap) => {
        const d = dSnap.data();
        return {
          id: dSnap.id,
          animeId: typeof d.animeId === 'number' ? d.animeId : undefined,
          airingScheduleId:
            typeof d.airingScheduleId === 'number' ? d.airingScheduleId : undefined,
          title: String(d.title || 'Untitled Anime'),
          posterUrl: typeof d.posterUrl === 'string' ? d.posterUrl : undefined,
          episodeNumber: Number(d.episodeNumber || 1),
          releaseAt: Number(d.releaseAt || 0),
          status: (d.status || 'upcoming') as CalendarEpisodeStatus,
          removed: Boolean(d.removed),
          note: typeof d.note === 'string' ? d.note : undefined,
          updatedBy: String(d.updatedBy || ''),
          createdAt: toMillis(d.createdAt),
          updatedAt: toMillis(d.updatedAt),
        };
      });
      callback(list);
    },
    (err) => {
      logFirestoreError(err, OperationType.LIST, 'calendar_entries');
      callback([]);
    }
  );
}

export function mergeCalendarSchedule(
  apiItems: AiringScheduleItem[],
  overrides: CalendarScheduleOverride[],
  nowMs = Date.now()
): MergedCalendarEvent[] {
  const overrideByScheduleId = new Map<number, CalendarScheduleOverride>();
  const manualEntries: CalendarScheduleOverride[] = [];

  for (const ov of overrides) {
    if (ov.airingScheduleId && ov.airingScheduleId > 0) {
      overrideByScheduleId.set(ov.airingScheduleId, ov);
    } else {
      manualEntries.push(ov);
    }
  }

  const events: MergedCalendarEvent[] = [];

  for (const item of apiItems) {
    const ov = overrideByScheduleId.get(item.id);
    if (ov?.removed) continue;

    const releaseAtMs = ov?.releaseAt ? ov.releaseAt : item.airingAt * 1000;
    const defaultStatus: CalendarEpisodeStatus = releaseAtMs <= nowMs ? 'released' : 'upcoming';
    const status: CalendarEpisodeStatus = ov?.status
      ? ov.status
      : defaultStatus;

    events.push({
      key: `anilist_${item.id}`,
      airingScheduleId: item.id,
      overrideId: ov?.id,
      animeId: ov?.animeId ?? item.media.id,
      title: ov?.title || getDisplayTitle(item.media.title),
      posterUrl:
        ov?.posterUrl ||
        item.media.coverImage?.medium ||
        item.media.coverImage?.large ||
        undefined,
      episodeNumber: ov?.episodeNumber ?? item.episode,
      releaseAtMs,
      status,
      note: ov?.note,
      isManual: false,
      isOverridden: Boolean(ov),
    });
  }

  for (const man of manualEntries) {
    if (man.removed) continue;
    events.push({
      key: `manual_${man.id}`,
      overrideId: man.id,
      animeId: man.animeId,
      title: man.title,
      posterUrl: man.posterUrl,
      episodeNumber: man.episodeNumber,
      releaseAtMs: man.releaseAt,
      status: man.status,
      note: man.note,
      isManual: true,
      isOverridden: true,
    });
  }

  events.sort((a, b) => a.releaseAtMs - b.releaseAtMs);
  return events;
}

export interface AdminCalendarEntryInput {
  id?: string;
  animeId?: number;
  airingScheduleId?: number;
  title: string;
  posterUrl?: string;
  episodeNumber: number;
  releaseAt: number;
  status: CalendarEpisodeStatus;
  removed?: boolean;
  note?: string;
}

export async function saveCalendarEntry(
  adminUid: string,
  input: AdminCalendarEntryInput
): Promise<string> {
  if (!db) throw new Error('Firestore is not initialized.');
  const rawId =
    input.id ||
    (input.airingScheduleId
      ? `anilist_${input.airingScheduleId}`
      : `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const entryId = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);

  const payload: Record<string, unknown> = {
    id: entryId,
    title: input.title.trim().slice(0, 240) || 'Untitled Anime',
    episodeNumber: Math.max(0, Math.round(Number(input.episodeNumber) || 1)),
    releaseAt: Math.max(0, Math.round(Number(input.releaseAt) || Date.now())),
    status: input.status,
    removed: Boolean(input.removed),
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  };
  if (typeof input.animeId === 'number' && input.animeId >= 0) {
    payload.animeId = Math.round(input.animeId);
  }
  if (typeof input.airingScheduleId === 'number' && input.airingScheduleId >= 0) {
    payload.airingScheduleId = Math.round(input.airingScheduleId);
  }
  if (input.posterUrl && input.posterUrl.trim()) {
    payload.posterUrl = input.posterUrl.trim().slice(0, 500);
  }
  if (input.note && input.note.trim()) {
    payload.note = input.note.trim().slice(0, 300);
  }

  if (input.id) {
    await updateDoc(doc(db, 'calendar_entries', entryId), payload).catch(async () => {
      await setDoc(doc(db!, 'calendar_entries', entryId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    });
  } else {
    await setDoc(doc(db, 'calendar_entries', entryId), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }
  return entryId;
}

export async function deleteCalendarEntry(entryId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await deleteDoc(doc(db, 'calendar_entries', entryId));
}
