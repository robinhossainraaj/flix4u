import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Film,
  Megaphone,
  Smartphone,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useNotifications } from '@/src/context/NotificationContext';
import { NOTIFICATION_CATEGORY_LABELS } from '@/src/services/notificationService';
import type { NotificationCategory, UnifiedNotificationItem } from '@/src/types/anime';

export function getNotificationCategoryMeta(category: NotificationCategory): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  iconClass: string;
} {
  switch (category) {
    case 'new_episode':
      return {
        label: NOTIFICATION_CATEGORY_LABELS.new_episode,
        icon: Film,
        badgeClass: 'border-violet-400/35 bg-violet-500/15 text-violet-300',
        iconClass: 'text-violet-300',
      };
    case 'new_release':
      return {
        label: NOTIFICATION_CATEGORY_LABELS.new_release,
        icon: Sparkles,
        badgeClass: 'border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-300',
        iconClass: 'text-fuchsia-300',
      };
    case 'app_update':
      return {
        label: NOTIFICATION_CATEGORY_LABELS.app_update,
        icon: Smartphone,
        badgeClass: 'border-cyan-400/35 bg-cyan-500/15 text-cyan-300',
        iconClass: 'text-cyan-300',
      };
    case 'maintenance':
      return {
        label: NOTIFICATION_CATEGORY_LABELS.maintenance,
        icon: Wrench,
        badgeClass: 'border-amber-400/35 bg-amber-500/15 text-amber-300',
        iconClass: 'text-amber-300',
      };
    case 'service_alert':
      return {
        label: NOTIFICATION_CATEGORY_LABELS.service_alert,
        icon: AlertTriangle,
        badgeClass: 'border-rose-400/35 bg-rose-500/15 text-rose-300',
        iconClass: 'text-rose-300',
      };
    case 'admin_announcement':
    default:
      return {
        label: NOTIFICATION_CATEGORY_LABELS.admin_announcement,
        icon: Megaphone,
        badgeClass: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300',
        iconClass: 'text-emerald-300',
      };
  }
}

export function formatRelativeNotificationTime(ms: number): string {
  if (!ms) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markRead, markAllRead, removeNotification } =
    useNotifications();

  const [open, setOpen] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const recentItems = notifications.slice(0, 6);

  const handleItemOpen = async (item: UnifiedNotificationItem) => {
    if (!item.read) {
      await markRead(item).catch(() => {});
    }
    setOpen(false);
    if (item.actionUrl) {
      if (/^https?:\/\//i.test(item.actionUrl)) {
        window.location.assign(item.actionUrl);
      } else {
        navigate(item.actionUrl);
      }
    } else if (item.animeId) {
      navigate(`/anime/${item.animeId}`);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAll = async () => {
    setBusyAll(true);
    try {
      await markAllRead();
    } finally {
      setBusyAll(false);
    }
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        className="kuro-btn-glass relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl text-slate-200 hover:text-white transition-colors"
      >
        <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(168,85,247,0.7)] tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-[62px] sm:top-12 z-50 w-[calc(100vw-1.5rem)] sm:w-[390px] overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0b0d17]/95 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3.5">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="h-4 w-4 shrink-0 text-violet-400" />
              <h3 className="text-sm font-bold text-white truncate">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-lg border border-violet-400/35 bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-200 tabular-nums">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busyAll}
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-violet-300 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-white/[0.06]">
            {loading ? (
              <div className="space-y-2.5 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))}
              </div>
            ) : recentItems.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-slate-500" />
                <p className="mt-2.5 text-sm font-semibold text-slate-200">
                  You&apos;re all caught up
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  New episodes, announcements, and app updates will show up here.
                </p>
              </div>
            ) : (
              recentItems.map((item) => {
                const meta = getNotificationCategoryMeta(item.category);
                const Icon = meta.icon;
                return (
                  <div
                    key={`${item.source}-${item.id}`}
                    className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                      item.read ? 'bg-transparent hover:bg-white/[0.03]' : 'bg-violet-500/[0.06] hover:bg-violet-500/[0.1]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleItemOpen(item)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${meta.badgeClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {meta.label}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">
                            {formatRelativeNotificationTime(item.createdAt)}
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 line-clamp-1 text-xs font-bold ${
                            item.read ? 'text-slate-300' : 'text-white'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                          {item.message}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                      {!item.read && (
                        <button
                          type="button"
                          onClick={() => void markRead(item)}
                          title="Mark as read"
                          aria-label="Mark as read"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-violet-300 hover:bg-violet-500/20 hover:text-white transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeNotification(item)}
                        title="Delete notification"
                        aria-label="Delete notification"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-rose-500/35 hover:bg-rose-500/15 hover:text-rose-300 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-violet-500/15 border border-violet-400/25 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 hover:text-white transition-colors"
            >
              <span>Open Full Notification Center</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
