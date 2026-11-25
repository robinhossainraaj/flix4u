import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  formatRelativeNotificationTime,
  getNotificationCategoryMeta,
} from '@/src/components/NotificationBell';
import { useNotifications } from '@/src/context/NotificationContext';
import {
  ALL_NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
} from '@/src/services/notificationService';
import type { NotificationCategory, UnifiedNotificationItem } from '@/src/types/anime';

type FilterMode = 'all' | 'unread' | NotificationCategory;

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markRead, markAllRead, removeNotification } =
    useNotifications();

  const [filter, setFilter] = useState<FilterMode>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !item.read;
      return item.category === filter;
    });
  }, [notifications, filter]);

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleAction = async (item: UnifiedNotificationItem) => {
    if (!item.read) {
      await markRead(item).catch(() => {});
    }
    if (item.actionUrl) {
      if (/^https?:\/\//i.test(item.actionUrl)) {
        window.location.assign(item.actionUrl);
      } else {
        navigate(item.actionUrl);
      }
    } else if (item.animeId) {
      navigate(`/anime/${item.animeId}`);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="kuro-glass rounded-3xl border border-white/[0.08] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-500/20 text-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.3)]">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Notification Center
                </h1>
                {unreadCount > 0 && (
                  <span className="rounded-lg border border-violet-400/40 bg-violet-500/20 px-2.5 py-0.5 text-xs font-bold text-violet-200 tabular-nums">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                Real-time episode releases, service alerts, app updates, and announcements
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              disabled={markingAll}
              onClick={handleMarkAll}
              className="kuro-btn-primary inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold text-white"
            >
              <CheckCheck className="h-4 w-4" />
              <span>{markingAll ? 'Updating...' : 'Mark All as Read'}</span>
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'all' ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'unread' ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
            }`}
          >
            Unread ({unreadCount})
          </button>
          {ALL_NOTIFICATION_CATEGORIES.map((cat) => {
            const count = notifications.filter((n) => n.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === cat ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                }`}
              >
                {NOTIFICATION_CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#10121d]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="kuro-glass rounded-3xl border border-white/[0.08] px-6 py-14 text-center">
          <Bell className="mx-auto h-9 w-9 text-slate-500" />
          <h2 className="mt-3 text-base font-bold text-white">No notifications to display</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {filter === 'unread'
              ? 'All your notifications have been marked as read.'
              : 'Add airing anime to your watchlist or check back later for updates.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const meta = getNotificationCategoryMeta(item.category);
            const Icon = meta.icon;
            const hasDestination = Boolean(item.actionUrl || item.animeId);
            return (
              <article
                key={`${item.source}-${item.id}`}
                className={`kuro-glass rounded-2xl border p-4 sm:p-5 transition-colors ${
                  item.read
                    ? 'border-white/[0.07] bg-[#0b0d17]/75'
                    : 'border-violet-500/40 bg-violet-950/20 shadow-[0_0_25px_-12px_rgba(139,92,246,0.5)]'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.badgeClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        {!item.read && (
                          <span className="rounded-lg bg-violet-500/25 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                            Unread
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {formatRelativeNotificationTime(item.createdAt)} ·{' '}
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-white break-words">
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-300 whitespace-pre-line break-words">
                        {item.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    {hasDestination && (
                      <button
                        type="button"
                        onClick={() => void handleAction(item)}
                        className="kuro-btn-glass inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-violet-400/30 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:text-white"
                      >
                        <span>Open</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => void markRead(item)}
                        className="kuro-btn-glass inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Mark Read</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void removeNotification(item)}
                      aria-label="Delete notification"
                      className="kuro-btn-glass inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-300 hover:border-rose-500/40 hover:text-rose-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
