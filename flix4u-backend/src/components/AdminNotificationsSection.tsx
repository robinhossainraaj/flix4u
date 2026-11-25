import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  Check,
  Edit3,
  Loader2,
  Megaphone,
  Plus,
  Power,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useNotifications } from '@/src/context/NotificationContext';
import {
  ALL_NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  createAnnouncementNotification,
  deleteAnnouncementNotification,
  fetchUsersForNotificationTargeting,
  isNotificationScheduleActive,
  subscribeAllGlobalNotificationsForAdmin,
  updateAnnouncementNotification,
  updateNotificationCategorySettings,
  type AdminAnnouncementInput,
  type TargetableUserOption,
} from '@/src/services/notificationService';
import type { GlobalNotificationRecord, NotificationCategory } from '@/src/types/anime';

const EMPTY_FORM: AdminAnnouncementInput = {
  category: 'admin_announcement',
  title: '',
  message: '',
  targetType: 'all',
  targetUserIds: [],
  actionUrl: '',
  enabled: true,
  startAt: '',
  expiresAt: '',
};

export const AdminNotificationsSection: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { categorySettings } = useNotifications();

  const [announcements, setAnnouncements] = useState<GlobalNotificationRecord[]>([]);
  const [usersList, setUsersList] = useState<TargetableUserOption[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [form, setForm] = useState<AdminAnnouncementInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeAllGlobalNotificationsForAdmin(
      (items) => setAnnouncements(items),
      (msg) => setError(msg)
    );
    fetchUsersForNotificationTargeting()
      .then((list) => setUsersList(list))
      .catch(() => {});
    return () => unsub();
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [usersList, userSearch]);

  const handleToggleCategory = async (cat: NotificationCategory) => {
    if (!user) return;
    setSavingCategories(true);
    setError(null);
    try {
      const nextMap = {
        ...categorySettings.enabledCategories,
        [cat]: !categorySettings.enabledCategories[cat],
      };
      await updateNotificationCategorySettings(user.uid, nextMap);
      setNotice(
        `${NOTIFICATION_CATEGORY_LABELS[cat]} notifications ${nextMap[cat] ? 'enabled' : 'disabled'}.`
      );
      window.setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category settings.');
    } finally {
      setSavingCategories(false);
    }
  };

  const toggleTargetUser = (uid: string) => {
    setForm((prev) => {
      const exists = prev.targetUserIds.includes(uid);
      return {
        ...prev,
        targetUserIds: exists
          ? prev.targetUserIds.filter((id) => id !== uid)
          : [...prev.targetUserIds, uid],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setNotice(null);

    if (!form.title.trim()) {
      setError('Notification title is required.');
      return;
    }
    if (!form.message.trim()) {
      setError('Notification message is required.');
      return;
    }
    if (form.targetType === 'selected' && form.targetUserIds.length === 0) {
      setError('Select at least one recipient user, or switch targeting to All Users.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateAnnouncementNotification(editingId, form);
        setNotice('Notification announcement updated.');
      } else {
        await createAnnouncementNotification(user.uid, form);
        setNotice('Notification published successfully.');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      window.setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: GlobalNotificationRecord) => {
    setEditingId(item.id);
    setForm({
      category: item.category,
      title: item.title,
      message: item.message,
      targetType: item.targetType,
      targetUserIds: item.targetUserIds,
      actionUrl: item.actionUrl || '',
      animeId: item.animeId,
      enabled: item.enabled,
      startAt: item.startAt || '',
      expiresAt: item.expiresAt || '',
    });
    setError(null);
  };

  const handleToggleEnabled = async (item: GlobalNotificationRecord) => {
    try {
      await updateAnnouncementNotification(item.id, { enabled: !item.enabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  };

  const handleDelete = async (notifId: string) => {
    try {
      await deleteAnnouncementNotification(notifId);
      if (editingId === notifId) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      setConfirmDeleteId(null);
      setNotice('Announcement deleted.');
      window.setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification.');
    }
  };

  const getScheduleBadge = (item: GlobalNotificationRecord) => {
    if (!item.enabled) return { label: 'Disabled', cls: 'border-slate-500/30 bg-slate-500/15 text-slate-300' };
    const now = Date.now();
    if (item.startAt && Date.parse(item.startAt) > now) {
      return { label: 'Scheduled', cls: 'border-amber-400/35 bg-amber-500/15 text-amber-300' };
    }
    if (item.expiresAt && Date.parse(item.expiresAt) < now) {
      return { label: 'Expired', cls: 'border-rose-400/35 bg-rose-500/15 text-rose-300' };
    }
    return isNotificationScheduleActive(item, now)
      ? { label: 'Active', cls: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300' }
      : { label: 'Inactive', cls: 'border-slate-500/30 bg-slate-500/15 text-slate-300' };
  };

  return (
    <div className="space-y-6">
      {(notice || error) && (
        <div className="space-y-2">
          {notice && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-3 text-xs font-medium text-emerald-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-xs font-medium text-rose-200">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Global Notification Type Switches */}
      <section className="kuro-glass rounded-3xl border border-white/[0.08] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-violet-400" />
              <span>Notification Category Controls</span>
            </h2>
            <p className="text-xs text-slate-400">
              Globally enable or disable specific notification categories across Flix4U
            </p>
          </div>
          {savingCategories && (
            <span className="inline-flex items-center gap-1.5 text-xs text-violet-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_NOTIFICATION_CATEGORIES.map((cat) => {
            const enabled = categorySettings.enabledCategories[cat] !== false;
            return (
              <button
                key={cat}
                type="button"
                disabled={savingCategories}
                onClick={() => void handleToggleCategory(cat)}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  enabled
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-white'
                    : 'border-white/[0.08] bg-[#080a12] text-slate-400'
                }`}
              >
                <span className="text-xs font-semibold">{NOTIFICATION_CATEGORY_LABELS[cat]}</span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                    enabled
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : 'bg-white/[0.06] text-slate-400'
                  }`}
                >
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Create / Schedule Notification Form */}
      <section className="kuro-glass rounded-3xl border border-white/[0.08] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-amber-400" />
              <span>
                {editingId ? 'Edit Notification Announcement' : 'Create & Schedule Notification'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Send real-time notifications to all registered users or targeted recipients
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="kuro-btn-glass rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Notification Type *
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value as NotificationCategory }))
                }
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs sm:text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {ALL_NOTIFICATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {NOTIFICATION_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Target Audience *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, targetType: 'all' }))}
                  className={`h-11 rounded-xl border text-xs font-bold transition-colors ${
                    form.targetType === 'all'
                      ? 'border-violet-400 bg-violet-600/25 text-white'
                      : 'border-white/[0.1] bg-[#07080d] text-slate-400'
                  }`}
                >
                  All Users
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, targetType: 'selected' }))}
                  className={`h-11 rounded-xl border text-xs font-bold transition-colors ${
                    form.targetType === 'selected'
                      ? 'border-violet-400 bg-violet-600/25 text-white'
                      : 'border-white/[0.1] bg-[#07080d] text-slate-400'
                  }`}
                >
                  Selected Users ({form.targetUserIds.length})
                </button>
              </div>
            </div>
          </div>

          {form.targetType === 'selected' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#080a12] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-violet-400" />
                  <span>Select Recipients ({form.targetUserIds.length} selected)</span>
                </span>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Filter by name or email..."
                    className="h-9 w-full rounded-xl border border-white/[0.1] bg-[#05060b] pl-8 pr-3 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredUsers.map((u) => {
                  const selected = form.targetUserIds.includes(u.uid);
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => toggleTargetUser(u.uid)}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                        selected
                          ? 'border-violet-400/60 bg-violet-500/20 text-white'
                          : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{u.displayName}</p>
                        {u.email && <p className="truncate text-[11px] text-slate-400">{u.email}</p>}
                      </div>
                      {selected && <Check className="h-4 w-4 shrink-0 text-violet-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Title *
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Scheduled Maintenance Tonight"
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Optional Link URL (internal /path or https://...)
              </label>
              <input
                type="text"
                maxLength={500}
                value={form.actionUrl || ''}
                onChange={(e) => setForm((p) => ({ ...p, actionUrl: e.target.value }))}
                placeholder="/schedule or /anime/21"
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Message *
            </label>
            <textarea
              rows={3}
              required
              maxLength={1200}
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="Write the full notification message..."
              className="w-full rounded-xl border border-white/[0.1] bg-[#07080d] p-3 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                <span>Schedule Start (Optional)</span>
              </label>
              <input
                type="datetime-local"
                value={form.startAt || ''}
                onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                <span>Expires At (Optional)</span>
              </label>
              <input
                type="datetime-local"
                value={form.expiresAt || ''}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <label className="flex h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-xs font-semibold text-slate-200">
                <span>Publish Active Immediately</span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                  className="h-4 w-4 accent-violet-500"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 py-2.5 text-xs sm:text-sm font-semibold text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Check className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{editingId ? 'Save Changes' : 'Publish Notification'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Published & Scheduled Announcements */}
      <section className="kuro-glass rounded-3xl border border-white/[0.08] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white">
            Published &amp; Scheduled Announcements ({announcements.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
            }}
            className="kuro-btn-glass inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-violet-200"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
        </div>

        {announcements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-400">
            No announcements published yet. Create one above to notify Flix4U users.
          </p>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => {
              const status = getScheduleBadge(item);
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#080a12]/90 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                      <span className="rounded-lg border border-violet-400/25 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                        {NOTIFICATION_CATEGORY_LABELS[item.category]}
                      </span>
                      <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {item.targetType === 'all'
                          ? 'All Users'
                          : `${item.targetUserIds.length} Selected User${item.targetUserIds.length === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white break-words">{item.title}</h3>
                    <p className="text-xs text-slate-400 break-words">{item.message}</p>
                    {(item.startAt || item.expiresAt) && (
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {item.startAt ? `Starts: ${new Date(item.startAt).toLocaleString()}` : ''}
                        {item.startAt && item.expiresAt ? ' · ' : ''}
                        {item.expiresAt ? `Expires: ${new Date(item.expiresAt).toLocaleString()}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="kuro-btn-glass inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-200"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleEnabled(item)}
                      className="kuro-btn-glass inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-200"
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{item.enabled ? 'Disable' : 'Enable'}</span>
                    </button>
                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="kuro-btn-glass rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="kuro-btn-glass flex h-9 w-9 items-center justify-center rounded-xl text-rose-300 hover:border-rose-500/40"
                        aria-label="Delete announcement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
