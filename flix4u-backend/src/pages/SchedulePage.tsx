import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookmarkCheck,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Globe,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { useAuth } from '@/src/context/AuthContext';
import { useNotifications } from '@/src/context/NotificationContext';
import { slugifyTitle } from '@/src/services/anilistApi';
import {
  deleteCalendarEntry,
  fetchAnilistScheduleWindow,
  mergeCalendarSchedule,
  saveCalendarEntry,
  subscribeCalendarOverrides,
} from '@/src/services/calendarService';
import type {
  AiringScheduleItem,
  CalendarEpisodeStatus,
  CalendarScheduleOverride,
  MergedCalendarEvent,
} from '@/src/types/anime';

type ViewMode = 'weekly' | 'monthly';
type StatusFilter = 'all' | CalendarEpisodeStatus;

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalDateTimeInput(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function getStatusBadge(status: CalendarEpisodeStatus): { label: string; cls: string } {
  switch (status) {
    case 'released':
      return {
        label: 'Released',
        cls: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300',
      };
    case 'delayed':
      return {
        label: 'Delayed',
        cls: 'border-rose-400/35 bg-rose-500/15 text-rose-300',
      };
    case 'upcoming':
    default:
      return {
        label: 'Upcoming',
        cls: 'border-violet-400/35 bg-violet-500/15 text-violet-200',
      };
  }
}

interface AdminModalFormState {
  overrideId?: string;
  airingScheduleId?: number;
  animeIdStr: string;
  title: string;
  posterUrl: string;
  episodeNumber: number;
  releaseLocal: string;
  status: CalendarEpisodeStatus;
  note: string;
}

export const SchedulePage: React.FC = () => {
  const { user, isAdmin, isInWatchlist } = useAuth();
  const { syncCalendarAlerts } = useNotifications();

  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => toLocalDateKey(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [apiSchedule, setApiSchedule] = useState<AiringScheduleItem[]>([]);
  const [overrides, setOverrides] = useState<CalendarScheduleOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Admin modal state
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState<AdminModalFormState>({
    animeIdStr: '',
    title: '',
    posterUrl: '',
    episodeNumber: 1,
    releaseLocal: toLocalDateTimeInput(Date.now() + 3600_000),
    status: 'upcoming',
    note: '',
  });

  const timezoneName = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';
    } catch {
      return 'Local Time';
    }
  }, []);

  // Compute fetch window based on viewMode and anchorDate
  const windowBounds = useMemo(() => {
    const start = new Date(anchorDate);
    const end = new Date(anchorDate);
    if (viewMode === 'weekly') {
      const dayOfWeek = start.getDay(); // 0=Sun
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setDate(start.getDate() - 2);
      start.setHours(0, 0, 0, 0);
      end.setMonth(anchorDate.getMonth() + 1, 2);
      end.setHours(23, 59, 59, 999);
    }
    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
      startSec: Math.floor(start.getTime() / 1000),
      endSec: Math.floor(end.getTime() / 1000),
    };
  }, [anchorDate, viewMode]);

  useEffect(() => {
    const unsub = subscribeCalendarOverrides((list) => setOverrides(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchAnilistScheduleWindow(
          windowBounds.startSec,
          windowBounds.endSec,
          viewMode === 'monthly' ? 5 : 3
        );
        if (!active) return;
        setApiSchedule(items);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load anime release calendar.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [windowBounds.startSec, windowBounds.endSec, viewMode, reloadNonce]);

  const mergedEvents = useMemo(() => {
    return mergeCalendarSchedule(apiSchedule, overrides);
  }, [apiSchedule, overrides]);

  // Trigger followed-anime episode alerts automatically when schedule loads
  useEffect(() => {
    if (!loading && mergedEvents.length > 0) {
      void syncCalendarAlerts(mergedEvents);
    }
  }, [loading, mergedEvents, syncCalendarAlerts]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedEvents.filter((ev) => {
      if (statusFilter !== 'all' && ev.status !== statusFilter) return false;
      if (q && !ev.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mergedEvents, searchQuery, statusFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MergedCalendarEvent[]>();
    for (const ev of filteredEvents) {
      const k = toLocalDateKey(new Date(ev.releaseAtMs));
      const existing = map.get(k);
      if (existing) {
        existing.push(ev);
      } else {
        map.set(k, [ev]);
      }
    }
    return map;
  }, [filteredEvents]);

  // Weekly days array (Sun..Sat for the anchor week)
  const weekDays = useMemo(() => {
    const start = new Date(anchorDate);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateKey(d);
      return {
        key,
        date: d,
        short: d.toLocaleDateString(undefined, { weekday: 'short' }),
        sub: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        items: eventsByDay.get(key) || [],
      };
    });
  }, [anchorDate, eventsByDay]);

  // Monthly calendar cells (leading blanks + days of month)
  const monthGrid = useMemo(() => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const leadingBlanks = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const cells: Array<{
      key: string;
      dayNum: number;
      inMonth: boolean;
      events: MergedCalendarEvent[];
    }> = [];

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push({ key: `blank-${i}`, dayNum: 0, inMonth: false, events: [] });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month, day);
      const key = toLocalDateKey(d);
      cells.push({
        key,
        dayNum: day,
        inMonth: true,
        events: eventsByDay.get(key) || [],
      });
    }
    return {
      monthLabel: firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      cells,
    };
  }, [anchorDate, eventsByDay]);

  // Keep selectedDayKey within visible range when navigating
  useEffect(() => {
    if (viewMode === 'weekly') {
      const inWeek = weekDays.some((w) => w.key === selectedDayKey);
      if (!inWeek && weekDays[0]) {
        const todayKey = toLocalDateKey(new Date());
        const hasToday = weekDays.some((w) => w.key === todayKey);
        setSelectedDayKey(hasToday ? todayKey : weekDays[0].key);
      }
    } else {
      const ymPrefix = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`;
      if (!selectedDayKey.startsWith(ymPrefix)) {
        const todayKey = toLocalDateKey(new Date());
        setSelectedDayKey(todayKey.startsWith(ymPrefix) ? todayKey : `${ymPrefix}-01`);
      }
    }
  }, [viewMode, weekDays, anchorDate, selectedDayKey]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDay.get(selectedDayKey) || [];
  }, [eventsByDay, selectedDayKey]);

  const stepPeriod = (delta: number) => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'weekly') {
        next.setDate(next.getDate() + delta * 7);
      } else {
        next.setMonth(next.getMonth() + delta);
      }
      return next;
    });
  };

  const jumpToToday = () => {
    const now = new Date();
    setAnchorDate(now);
    setSelectedDayKey(toLocalDateKey(now));
  };

  // Admin CRUD handlers
  const openCreateModal = () => {
    setAdminError(null);
    setAdminForm({
      animeIdStr: '',
      title: '',
      posterUrl: '',
      episodeNumber: 1,
      releaseLocal: toLocalDateTimeInput(Date.now() + 3600_000),
      status: 'upcoming',
      note: '',
    });
    setAdminModalOpen(true);
  };

  const openEditModal = (ev: MergedCalendarEvent) => {
    setAdminError(null);
    setAdminForm({
      overrideId: ev.overrideId,
      airingScheduleId: ev.airingScheduleId,
      animeIdStr: ev.animeId ? String(ev.animeId) : '',
      title: ev.title,
      posterUrl: ev.posterUrl || '',
      episodeNumber: ev.episodeNumber,
      releaseLocal: toLocalDateTimeInput(ev.releaseAtMs),
      status: ev.status,
      note: ev.note || '',
    });
    setAdminModalOpen(true);
  };

  const handleSaveAdminEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setAdminError(null);

    const parsedMs = Date.parse(adminForm.releaseLocal);
    if (!adminForm.title.trim()) {
      setAdminError('Anime title is required.');
      return;
    }
    if (Number.isNaN(parsedMs)) {
      setAdminError('Please select a valid release date and time.');
      return;
    }

    const parsedAnimeId = Number(adminForm.animeIdStr);
    setAdminSaving(true);
    try {
      await saveCalendarEntry(user.uid, {
        id: adminForm.overrideId,
        airingScheduleId: adminForm.airingScheduleId,
        animeId: Number.isFinite(parsedAnimeId) && parsedAnimeId > 0 ? parsedAnimeId : undefined,
        title: adminForm.title.trim(),
        posterUrl: adminForm.posterUrl.trim() || undefined,
        episodeNumber: Math.max(0, Number(adminForm.episodeNumber) || 1),
        releaseAt: parsedMs,
        status: adminForm.status,
        removed: false,
        note: adminForm.note.trim() || undefined,
      });
      setAdminModalOpen(false);
      setAdminNotice('Release calendar entry saved.');
      window.setTimeout(() => setAdminNotice(null), 3000);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to save schedule entry.');
    } finally {
      setAdminSaving(false);
    }
  };

  const handleQuickStatus = async (ev: MergedCalendarEvent, nextStatus: CalendarEpisodeStatus) => {
    if (!user || !isAdmin) return;
    try {
      await saveCalendarEntry(user.uid, {
        id: ev.overrideId,
        airingScheduleId: ev.airingScheduleId,
        animeId: ev.animeId,
        title: ev.title,
        posterUrl: ev.posterUrl,
        episodeNumber: ev.episodeNumber,
        releaseAt: ev.releaseAtMs,
        status: nextStatus,
        removed: false,
        note: ev.note,
      });
      setAdminNotice(`${ev.title} Ep ${ev.episodeNumber} marked as ${nextStatus}.`);
      window.setTimeout(() => setAdminNotice(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleRemoveEntry = async (ev: MergedCalendarEvent) => {
    if (!user || !isAdmin) return;
    try {
      if (ev.isManual && ev.overrideId) {
        await deleteCalendarEntry(ev.overrideId);
      } else {
        await saveCalendarEntry(user.uid, {
          id: ev.overrideId,
          airingScheduleId: ev.airingScheduleId,
          animeId: ev.animeId,
          title: ev.title,
          posterUrl: ev.posterUrl,
          episodeNumber: ev.episodeNumber,
          releaseAt: ev.releaseAtMs,
          status: ev.status,
          removed: true,
        });
      }
      setAdminNotice(`Removed "${ev.title}" Ep ${ev.episodeNumber} from calendar.`);
      window.setTimeout(() => setAdminNotice(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove schedule entry.');
    }
  };

  const todayKey = toLocalDateKey(new Date());
  const selectedDayDate = useMemo(() => {
    const parts = selectedDayKey.split('-').map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  }, [selectedDayKey]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header & Controls */}
      <div className="kuro-glass rounded-3xl border border-white/[0.08] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-200">
              <Globe className="h-3.5 w-3.5 text-violet-300" />
              <span>Local Timezone: {timezoneName}</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white">
              Anime Release Calendar
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Weekly &amp; monthly simulcast schedule with watchlist episode alerts and release status
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Weekly / Monthly View Toggle */}
            <div className="kuro-segment-track flex rounded-2xl border border-white/[0.08] bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === 'weekly' ? 'kuro-segment-active text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Weekly View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === 'monthly' ? 'kuro-segment-active text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly Calendar
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={openCreateModal}
                className="kuro-btn-primary inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                <span>Add Entry</span>
              </button>
            )}
          </div>
        </div>

        {/* Period Nav + Search + Status Filter */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepPeriod(-1)}
              aria-label="Previous period"
              className="kuro-btn-glass flex h-10 w-10 items-center justify-center rounded-xl text-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={jumpToToday}
              className="kuro-btn-glass h-10 rounded-xl px-3.5 text-xs font-semibold text-violet-200"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => stepPeriod(1)}
              aria-label="Next period"
              className="kuro-btn-glass flex h-10 w-10 items-center justify-center rounded-xl text-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-2 text-sm font-bold text-white tabular-nums">
              {viewMode === 'monthly'
                ? monthGrid.monthLabel
                : `${weekDays[0]?.sub || ''} – ${weekDays[6]?.sub || ''}`}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anime in calendar..."
                className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] pl-9 pr-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['all', 'upcoming', 'released', 'delayed'] as StatusFilter[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`h-10 rounded-xl px-3 text-xs font-semibold capitalize transition-colors ${
                    statusFilter === st ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {adminNotice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-3 text-xs font-medium text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{adminNotice}</span>
        </div>
      )}

      {error ? (
        <div className="kuro-glass rounded-3xl border-rose-500/30 bg-rose-500/10 p-6 sm:p-8 text-center">
          <h2 className="text-base sm:text-lg font-bold text-white">Failed to load schedule</h2>
          <p className="mt-2 text-xs sm:text-sm text-rose-200 break-words">{error}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="kuro-btn-primary mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-5 py-2 text-xs sm:text-sm font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retry</span>
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#121420]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#121420]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'weekly' ? (
            <div
              className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
              role="tablist"
              aria-label="Weekly schedule days"
            >
              {weekDays.map((day) => {
                const active = day.key === selectedDayKey;
                const isToday = day.key === todayKey;
                return (
                  <button
                    key={day.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedDayKey(day.key)}
                    className={`flex min-w-[116px] flex-1 shrink-0 flex-col items-center rounded-2xl px-4 py-3 transition-all ${
                      active ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {day.short}
                      {isToday && (
                        <span className="rounded bg-violet-400/25 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">
                          TODAY
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 text-xs opacity-80 tabular-nums">{day.sub}</span>
                    <span className="mt-1 rounded-lg bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                      {day.items.length} eps
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Monthly Calendar Grid */
            <div className="kuro-glass rounded-3xl border border-white/[0.08] p-3 sm:p-5 overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 gap-2 pb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthGrid.cells.map((cell) => {
                    if (!cell.inMonth) {
                      return (
                        <div
                          key={cell.key}
                          className="min-h-[86px] rounded-2xl border border-white/[0.03] bg-white/[0.01]"
                        />
                      );
                    }
                    const selected = cell.key === selectedDayKey;
                    const isToday = cell.key === todayKey;
                    const hasWatchlist = cell.events.some(
                      (ev) => ev.animeId && isInWatchlist(ev.animeId)
                    );
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setSelectedDayKey(cell.key)}
                        className={`flex min-h-[86px] flex-col justify-between rounded-2xl border p-2 text-left transition-all ${
                          selected
                            ? 'border-violet-400 bg-violet-600/20 shadow-[0_0_20px_rgba(139,92,246,0.25)]'
                            : isToday
                              ? 'border-cyan-400/45 bg-cyan-500/10'
                              : 'border-white/[0.07] bg-[#0a0c15]/80 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              isToday ? 'text-cyan-300' : 'text-white'
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {hasWatchlist && (
                            <BookmarkCheck className="h-3.5 w-3.5 text-amber-300" />
                          )}
                        </div>

                        <div className="space-y-1">
                          {cell.events.slice(0, 2).map((ev) => (
                            <p
                              key={ev.key}
                              className="truncate rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-200"
                            >
                              {ev.title}
                            </p>
                          ))}
                          {cell.events.length > 2 && (
                            <p className="text-[10px] font-semibold text-violet-300 tabular-nums">
                              +{cell.events.length - 2} more
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Selected Day Episodes Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-violet-400" />
              <span>
                {selectedDayDate.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </h2>
            <span className="text-xs text-slate-400 tabular-nums">
              {selectedDayEvents.length} episode{selectedDayEvents.length === 1 ? '' : 's'}
            </span>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="kuro-glass rounded-3xl border border-white/[0.08] p-10 text-center">
              <CalendarIcon className="mx-auto h-8 w-8 text-violet-400" />
              <p className="mt-3 text-sm font-semibold text-white">
                No releases match your filter for this day
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Select another date or adjust your status/search filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {selectedDayEvents.map((ev) => {
                const airTime = new Date(ev.releaseAtMs).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const statusBadge = getStatusBadge(ev.status);
                const followed = ev.animeId ? isInWatchlist(ev.animeId) : false;
                const epSlug = `${slugifyTitle(ev.title) || `anime-${ev.animeId || 0}`}-episode-${ev.episodeNumber}`;

                return (
                  <div
                    key={ev.key}
                    className="kuro-glass flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.08] p-4 hover:border-violet-500/45 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {ev.animeId ? (
                        <Link
                          to={`/anime/${ev.animeId}`}
                          className="flex min-w-0 flex-1 items-start gap-3.5"
                        >
                          <AnimeImage
                            src={ev.posterUrl}
                            alt={ev.title}
                            className="h-20 w-14 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusBadge.cls}`}
                              >
                                {statusBadge.label}
                              </span>
                              {followed && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                  <BookmarkCheck className="h-3 w-3" />
                                  Watchlist
                                </span>
                              )}
                              {ev.isOverridden && (
                                <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
                                  Admin Updated
                                </span>
                              )}
                            </div>
                            <h3 className="line-clamp-1 text-sm font-bold text-white hover:text-violet-300 transition-colors">
                              {ev.title}
                            </h3>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 tabular-nums">
                              <span className="inline-flex items-center gap-1 text-violet-300 font-medium">
                                <Clock className="h-3 w-3" />
                                {airTime}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Episode {ev.episodeNumber}</span>
                            </div>
                            {ev.note && (
                              <p className="mt-1 text-[11px] text-amber-200/90 line-clamp-1">
                                Note: {ev.note}
                              </p>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-start gap-3.5">
                          <AnimeImage
                            src={ev.posterUrl}
                            alt={ev.title}
                            className="h-20 w-14 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusBadge.cls}`}
                              >
                                {statusBadge.label}
                              </span>
                            </div>
                            <h3 className="line-clamp-1 text-sm font-bold text-white">
                              {ev.title}
                            </h3>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 tabular-nums">
                              <span className="inline-flex items-center gap-1 text-violet-300 font-medium">
                                <Clock className="h-3 w-3" />
                                {airTime}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Episode {ev.episodeNumber}</span>
                            </div>
                            {ev.note && (
                              <p className="mt-1 text-[11px] text-amber-200/90 line-clamp-1">
                                Note: {ev.note}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {ev.animeId && (
                        <Link
                          to={`/watch/${ev.animeId}/${encodeURIComponent(epSlug)}?ep=${ev.episodeNumber}`}
                          className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          <Play className="h-3.5 w-3.5 fill-current text-violet-300" />
                          <span>Ep {ev.episodeNumber}</span>
                        </Link>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-white/[0.06] pt-2.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(ev)}
                          className="kuro-btn-glass inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold text-slate-200"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        {ev.status !== 'released' && (
                          <button
                            type="button"
                            onClick={() => void handleQuickStatus(ev, 'released')}
                            className="kuro-btn-glass inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold text-emerald-300"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Released</span>
                          </button>
                        )}
                        {ev.status !== 'delayed' && (
                          <button
                            type="button"
                            onClick={() => void handleQuickStatus(ev, 'delayed')}
                            className="kuro-btn-glass inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold text-amber-300"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            <span>Delayed</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleRemoveEntry(ev)}
                          className="kuro-btn-glass inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold text-rose-300"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Admin Add/Edit Calendar Entry Modal */}
      {isAdmin && adminModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="kuro-glass-elevated w-full max-w-lg rounded-3xl border border-white/[0.12] bg-[#0b0d17] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/[0.08]">
              <h2 className="text-lg font-bold text-white">
                {adminForm.overrideId || adminForm.airingScheduleId
                  ? 'Edit Release Schedule Entry'
                  : 'Add Manual Release Entry'}
              </h2>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminEntry} className="mt-4 space-y-4">
              {adminError && (
                <div className="rounded-xl border border-rose-500/35 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200">
                  {adminError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Anime Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={240}
                  value={adminForm.title}
                  onChange={(e) => setAdminForm((p) => ({ ...p, title: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Episode Number *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={adminForm.episodeNumber}
                    onChange={(e) =>
                      setAdminForm((p) => ({ ...p, episodeNumber: Number(e.target.value) || 1 }))
                    }
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Status *
                  </label>
                  <select
                    value={adminForm.status}
                    onChange={(e) =>
                      setAdminForm((p) => ({
                        ...p,
                        status: e.target.value as CalendarEpisodeStatus,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="released">Released</option>
                    <option value="delayed">Delayed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Release Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={adminForm.releaseLocal}
                    onChange={(e) => setAdminForm((p) => ({ ...p, releaseLocal: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    AniList Anime ID (Optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={adminForm.animeIdStr}
                    onChange={(e) => setAdminForm((p) => ({ ...p, animeIdStr: e.target.value }))}
                    placeholder="e.g. 21"
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Poster Image URL (Optional)
                </label>
                <input
                  type="url"
                  maxLength={500}
                  value={adminForm.posterUrl}
                  onChange={(e) => setAdminForm((p) => ({ ...p, posterUrl: e.target.value }))}
                  placeholder="https://..."
                  className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Release Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={adminForm.note}
                  onChange={(e) => setAdminForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. Special 1-hour broadcast or delayed 24h"
                  className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(false)}
                  className="kuro-btn-glass h-10 rounded-xl px-4 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminSaving}
                  className="kuro-btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-xs font-bold text-white"
                >
                  {adminSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Schedule Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
