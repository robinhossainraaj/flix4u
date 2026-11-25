import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Download,
  HardDrive,
  Heart,
  Loader2,
  Package,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  WifiOff,
  Sliders,
} from 'lucide-react';
import { AdminDashboardSection } from '@/src/components/AdminDashboardSection';
import { AnimeImage } from '@/src/components/AnimeImage';
import { AvatarGalleryModal } from '@/src/components/AvatarGalleryModal';
import {
  DownloadManagerModal,
  formatDownloadBytes,
  formatDownloadSpeed,
} from '@/src/components/DownloadManagerModal';
import { ExtensionManager } from '@/src/components/ExtensionManager';
import { OfflinePlayerModal } from '@/src/components/OfflinePlayerModal';
import { ThemeSelector } from '@/src/components/ThemeSelector';
import {
  getDefaultStreamingApiBase,
  getStreamingApiBase,
  setStreamingApiOverride,
} from '@/src/config/env';
import { useAuth } from '@/src/context/AuthContext';
import {
  cancelOrDeleteDownload,
  getStoredDownloads,
  pauseDownload,
  resumeDownload,
  retryDownload,
  type DownloadItem,
} from '@/src/services/downloadService';

type SettingsSectionId =
  | 'overview'
  | 'continue'
  | 'downloads'
  | 'watchlist'
  | 'favorites'
  | 'history'
  | 'general-settings'
  | 'sources'
  | 'admin';

export const SettingsPage: React.FC = () => {
  const {
    user,
    authReady,
    isAdmin,
    preferences,
    watchlist,
    favorites,
    history,
    openAuthModal,
    updatePreferences,
    removeHistoryItem,
    clearHistory,
  } = useAuth();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get('section') as SettingsSectionId) || 'overview';

  const [downloads, setDownloads] = useState<DownloadItem[]>(() => getStoredDownloads());
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const [avatarSavedToast, setAvatarSavedToast] = useState(false);
  const [nameInput, setNameInput] = useState(preferences.displayName);
  const [savedToast, setSavedToast] = useState(false);
  const [endpointInput, setEndpointInput] = useState(() => getStreamingApiBase());
  const [endpointSaved, setEndpointSaved] = useState(false);
  const [showDownloadManager, setShowDownloadManager] = useState(false);
  const [offlinePlayerItem, setOfflinePlayerItem] = useState<DownloadItem | null>(null);

  useEffect(() => {
    const sync = () => setDownloads(getStoredDownloads());
    sync();
    window.addEventListener('flix4u:downloads-updated', sync);
    const timer = window.setInterval(sync, 1200);
    return () => {
      window.removeEventListener('flix4u:downloads-updated', sync);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setNameInput(preferences.displayName);
  }, [preferences.displayName]);

  const setSection = (sec: SettingsSectionId) => {
    if (sec === 'admin' && !isAdmin) return;
    if (sec === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ section: sec }, { replace: true });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }
    if (!nameInput.trim()) return;
    await updatePreferences({ displayName: nameInput.trim() });
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2000);
  };

  const handleSaveAvatar = async (photoURL: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    await updatePreferences({ photoURL });
    setAvatarSavedToast(true);
    window.setTimeout(() => setAvatarSavedToast(false), 2500);
  };

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    setStreamingApiOverride(endpointInput.trim() || null);
    setEndpointSaved(true);
    window.setTimeout(() => setEndpointSaved(false), 2200);
  };

  const completedDownloadsCount = downloads.filter((d) => d.status === 'completed').length;
  const totalDownloadsBytes = downloads.reduce(
    (sum, d) => sum + (d.status === 'completed' ? d.fileSize || d.downloadedBytes : d.downloadedBytes),
    0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* Settings Header */}
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/[0.08] bg-[#0c0e18]/85 p-5 sm:p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              if (activeSection !== 'overview') {
                setSection('overview');
              } else {
                navigate(-1);
              }
            }}
            aria-label="Back"
            className="kuro-btn-glass flex h-11 w-11 items-center justify-center rounded-2xl text-slate-200 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                <Settings2 className="h-4 w-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">Flix4U Settings</h1>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
              {activeSection === 'overview'
                ? 'Manage your streaming library, playback preferences, servers, and account settings.'
                : `Viewing ${activeSection.replace('-', ' ')}`}
            </p>
          </div>
        </div>

        {activeSection !== 'overview' && (
          <button
            type="button"
            onClick={() => setSection('overview')}
            className="kuro-btn-glass inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-semibold text-violet-300"
          >
            <span>All Settings</span>
          </button>
        )}
      </div>

      {/* Overview Dashboard Menu Grid (when activeSection === 'overview') */}
      {activeSection === 'overview' && (
        <div className="space-y-8">
          {/* MY LIBRARY */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 px-1">
              My Library
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SettingsCard
                icon={Play}
                title="Continue Watching"
                subtitle={`${history.length} active show${history.length === 1 ? '' : 's'}`}
                badge={history.length}
                onClick={() => setSection('continue')}
              />
              <SettingsCard
                icon={Download}
                title="Downloads"
                subtitle={`${completedDownloadsCount} ready · ${formatDownloadBytes(totalDownloadsBytes)}`}
                badge={downloads.length}
                onClick={() => setSection('downloads')}
              />
              <SettingsCard
                icon={Bookmark}
                title="Watchlist"
                subtitle={`${watchlist.length} saved anime`}
                badge={watchlist.length}
                onClick={() => setSection('watchlist')}
              />
              <SettingsCard
                icon={Heart}
                title="Favorites"
                subtitle={`${favorites.length} favorited items`}
                badge={favorites.length}
                onClick={() => setSection('favorites')}
              />
              <SettingsCard
                icon={Clock}
                title="Watch History"
                subtitle={`${history.length} watched entries`}
                badge={history.length}
                onClick={() => setSection('history')}
              />
            </div>
          </section>

          {/* APP SETTINGS */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 px-1">
              App Settings
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SettingsCard
                icon={User}
                title="General Settings"
                subtitle="Display name, avatar & profile info"
                onClick={() => setSection('general-settings')}
              />
              <SettingsCard
                icon={Settings2}
                title="Playback & Audio"
                subtitle={`Audio: ${preferences.preferredAudio.toUpperCase()} · Auto Next: ${preferences.autoNext ? 'On' : 'Off'}`}
                onClick={() => setSection('general-settings')}
              />
              <SettingsCard
                icon={Sliders}
                title="Custom Themes & Accent Colors"
                subtitle="Personalize glassmorphic UI color themes"
                onClick={() => setSection('general-settings')}
              />
            </div>
          </section>

          {/* STREAMING */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-violet-400 px-1">
              Streaming & Sources
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SettingsCard
                icon={Package}
                title="Sources & Extensions"
                subtitle="Manage Aniyomi & Tachiyomi video sources"
                onClick={() => setSection('sources')}
              />
              <SettingsCard
                icon={Server}
                title="Manage Streaming Servers"
                subtitle="AnimeWorld India & primary HLS proxy nodes"
                onClick={() => setSection('sources')}
              />
            </div>
          </section>

          {/* ADMINISTRATION */}
          {isAdmin && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 px-1">
                Administration
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <SettingsCard
                  icon={ShieldCheck}
                  title="Admin Dashboard"
                  subtitle="System telemetry, presence metrics, and user management"
                  badge="Admin"
                  onClick={() => setSection('admin')}
                />
              </div>
            </section>
          )}
        </div>
      )}

      {/* Section Views */}
      {activeSection === 'continue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Continue Watching</h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="kuro-btn-glass inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <EmptySectionState
              title="No continue watching history"
              description="Start playing any episode to resume playback automatically."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {history.map((item) => {
                const pct =
                  item.durationSeconds > 0
                    ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
                    : 0;
                return (
                  <div
                    key={`${item.animeId}-${item.episodeId}`}
                    className="kuro-glass flex items-center justify-between gap-4 rounded-2xl p-3.5 hover:border-violet-500/45 transition-colors"
                  >
                    <Link
                      to={`/watch/${item.animeId}/${encodeURIComponent(item.episodeId)}?ep=${item.episodeNumber}`}
                      className="flex min-w-0 flex-1 items-center gap-3.5"
                    >
                      <AnimeImage
                        src={item.coverImage}
                        alt={item.title}
                        className="h-20 w-14 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white hover:text-violet-300">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
                          Episode {item.episodeNumber} · {item.audioMode.toUpperCase()}
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.1]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeHistoryItem(item.animeId)}
                      aria-label={`Remove ${item.title}`}
                      className="kuro-btn-glass flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === 'downloads' && (
        <div className="space-y-4">
          <div className="kuro-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-300 tabular-nums">
              <HardDrive className="h-4 w-4 text-emerald-400" />
              <span>
                {completedDownloadsCount} ready for offline playback ·{' '}
                {formatDownloadBytes(totalDownloadsBytes)} used
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDownloadManager(true)}
              className="kuro-btn-glass inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-violet-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Open Download Manager</span>
            </button>
          </div>

          {downloads.length === 0 ? (
            <EmptySectionState
              title="No offline downloads"
              description="Download episodes to watch them without internet connection."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {downloads.map((item) => {
                const isCompleted = item.status === 'completed';
                const isDownloading = item.status === 'downloading';
                const isQueued = item.status === 'queued';
                const isPaused = item.status === 'paused';
                const isError = item.status === 'error';
                const isUnsupported = item.status === 'unsupported';

                return (
                  <div
                    key={item.id}
                    className="kuro-glass flex flex-col justify-between gap-3 rounded-2xl p-3.5 sm:p-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <AnimeImage
                        src={item.coverImage}
                        alt={item.animeTitle}
                        className="h-20 w-14 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-violet-300 tabular-nums">
                          <span className="font-semibold">
                            EP {item.episodeNumber} · {item.audioMode.toUpperCase()}
                          </span>
                          <span className="uppercase text-slate-400">
                            · {item.format}
                            {item.serverName ? ` (${item.serverName})` : ''}
                          </span>
                        </div>
                        <p className="truncate text-sm font-bold text-white">{item.animeTitle}</p>
                        <p className="truncate text-xs text-slate-400">{item.episodeTitle}</p>

                        {isCompleted && (
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                            <WifiOff className="h-3.5 w-3.5 shrink-0" />
                            <span>Offline Ready</span>
                          </p>
                        )}

                        {(isDownloading || isQueued || isPaused) && (
                          <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                              <span>
                                {isQueued
                                  ? 'Queued...'
                                  : isDownloading
                                    ? `Downloading (${item.progress}%)`
                                    : `Paused (${item.progress}%)`}
                              </span>
                              {isDownloading && item.speedBytesPerSec > 0 && (
                                <span className="text-emerald-400">
                                  {formatDownloadSpeed(item.speedBytesPerSec)}
                                </span>
                              )}
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                                style={{ width: `${Math.max(2, item.progress)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {isUnsupported && (
                          <p className="text-[11px] text-amber-300">
                            {item.errorMessage || 'Download not supported for this stream format.'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] pt-2.5">
                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => setOfflinePlayerItem(item)}
                          className="kuro-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Play Offline</span>
                        </button>
                      )}
                      {(isDownloading || isQueued) && (
                        <button
                          type="button"
                          onClick={() => pauseDownload(item.id)}
                          className="kuro-btn-glass inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                        >
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pause</span>
                        </button>
                      )}
                      {isPaused && (
                        <button
                          type="button"
                          onClick={() => resumeDownload(item.id)}
                          className="kuro-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Resume</span>
                        </button>
                      )}
                      {isError && (
                        <button
                          type="button"
                          onClick={() => void retryDownload(item.id)}
                          className="kuro-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void cancelOrDeleteDownload(item.id)}
                        className="kuro-btn-glass flex h-9 w-9 items-center justify-center rounded-xl text-rose-300 hover:text-rose-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === 'watchlist' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Watchlist ({watchlist.length})</h2>
          {watchlist.length === 0 ? (
            <EmptySectionState
              title="Your watchlist is empty"
              description="Bookmark series or movies while exploring the catalog."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
              {watchlist.map((item) => (
                <Link
                  key={item.animeId}
                  to={`/anime/${item.animeId}`}
                  className="group flex flex-col"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10121c] group-hover:border-violet-500/50 transition-colors">
                    <AnimeImage
                      src={item.coverImage}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-100 group-hover:text-violet-300">
                    {item.title}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'favorites' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Favorites ({favorites.length})</h2>
          {favorites.length === 0 ? (
            <EmptySectionState
              title="No favorites yet"
              description="Tap Favorite on anime detail pages to keep them here."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
              {favorites.map((item) => (
                <Link
                  key={item.animeId}
                  to={`/anime/${item.animeId}`}
                  className="group flex flex-col"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10121c] group-hover:border-rose-500/50 transition-colors">
                    <AnimeImage
                      src={item.coverImage}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-100 group-hover:text-rose-300">
                    {item.title}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Watch History ({history.length})</h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="kuro-btn-glass inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <EmptySectionState
              title="No watch history"
              description="Your viewing history will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {history.map((item) => (
                <div
                  key={`${item.animeId}-${item.episodeId}`}
                  className="kuro-glass flex items-center justify-between gap-4 rounded-2xl p-3.5"
                >
                  <Link
                    to={`/watch/${item.animeId}/${encodeURIComponent(item.episodeId)}?ep=${item.episodeNumber}`}
                    className="flex min-w-0 flex-1 items-center gap-3.5"
                  >
                    <AnimeImage
                      src={item.coverImage}
                      alt={item.title}
                      className="h-16 w-12 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-slate-400">Episode {item.episodeNumber}</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeHistoryItem(item.animeId)}
                    className="kuro-btn-glass p-2 rounded-xl text-slate-400 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'general-settings' && (
        <div className="space-y-6">
          {/* User Account / Profile Card */}
          <section className="kuro-glass rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => (user ? setShowAvatarGallery(true) : openAuthModal())}
                  className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-violet-400/35 bg-[#141726]"
                >
                  <AnimeImage
                    src={preferences.photoURL}
                    alt={preferences.displayName}
                    variant="avatar"
                    className="h-full w-full object-cover object-top"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-4 w-4 text-white" />
                  </span>
                </button>
                <div>
                  <h3 className="text-lg font-bold text-white">{preferences.displayName}</h3>
                  <p className="text-xs text-slate-400">
                    {user ? `Signed in as ${user.email}` : 'Guest / Not signed in'}
                  </p>
                  {avatarSavedToast && (
                    <p className="mt-1 text-xs font-medium text-emerald-400">Avatar updated</p>
                  )}
                </div>
              </div>

              {user ? (
                <button
                  type="button"
                  onClick={() => setShowAvatarGallery(true)}
                  className="kuro-btn-glass rounded-2xl px-4 py-2 text-xs font-semibold"
                >
                  Change Avatar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="kuro-btn-primary rounded-2xl px-4 py-2 text-xs font-semibold"
                >
                  Sign In
                </button>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="border-t border-white/[0.08] pt-4 space-y-3">
              <label htmlFor="settings-display-name" className="block text-xs font-semibold text-slate-300">
                Display Name
              </label>
              <div className="flex gap-2 max-w-md">
                <input
                  id="settings-display-name"
                  type="text"
                  maxLength={60}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-10 flex-1 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="kuro-btn-glass rounded-xl px-4 text-xs font-semibold"
                >
                  {savedToast ? <Check className="h-4 w-4 text-emerald-400" /> : 'Save'}
                </button>
              </div>
            </form>
          </section>

          {/* Audio & Playback Preferences */}
          <section className="kuro-glass rounded-3xl p-5 sm:p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Default Audio Language</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Choose your preferred audio track for streaming.
              </p>
            </div>
            <div className="kuro-segment-track inline-flex flex-wrap rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => updatePreferences({ preferredAudio: 'sub' })}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  preferences.preferredAudio === 'sub' ? 'kuro-segment-active' : 'kuro-segment-idle'
                }`}
              >
                Japanese (Sub)
              </button>
              <button
                type="button"
                onClick={() => updatePreferences({ preferredAudio: 'dub' })}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  preferences.preferredAudio === 'dub' ? 'kuro-segment-active' : 'kuro-segment-idle'
                }`}
              >
                English (Dub)
              </button>
              <button
                type="button"
                onClick={() => updatePreferences({ preferredAudio: 'hindi' })}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  preferences.preferredAudio === 'hindi' ? 'kuro-segment-amber' : 'kuro-segment-idle'
                }`}
              >
                Hindi (Dub)
              </button>
            </div>

            <div className="border-t border-white/[0.08] pt-5 space-y-3">
              <h3 className="text-base font-bold text-white">Auto Next Episode</h3>
              <button
                type="button"
                onClick={() => updatePreferences({ autoNext: !preferences.autoNext })}
                className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${
                  preferences.autoNext ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
                }`}
              >
                Auto Play Next Episode: {preferences.autoNext ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </section>

          {/* Theme Selector */}
          <section className="kuro-glass rounded-3xl p-5 sm:p-6">
            <ThemeSelector />
          </section>

          {/* Streaming Endpoint Configuration */}
          <section className="kuro-glass rounded-3xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Streaming API Endpoint</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Configure custom streaming provider base URL.
              </p>
            </div>
            <form onSubmit={handleSaveEndpoint} className="space-y-3 max-w-xl">
              <div className="flex gap-2.5">
                <input
                  type="url"
                  value={endpointInput}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  placeholder={getDefaultStreamingApiBase()}
                  className="h-10 flex-1 rounded-xl border border-white/[0.1] bg-[#07080d]/85 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="kuro-btn-primary rounded-xl px-4 text-xs font-semibold"
                >
                  {endpointSaved ? 'Saved' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const def = getDefaultStreamingApiBase();
                    setEndpointInput(def);
                    setStreamingApiOverride(null);
                    setEndpointSaved(true);
                    window.setTimeout(() => setEndpointSaved(false), 2000);
                  }}
                  className="kuro-btn-glass rounded-xl px-3 text-xs font-semibold"
                >
                  Reset
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {activeSection === 'sources' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">Streaming Sources &amp; Extensions</h2>
          <ExtensionManager />
        </div>
      )}

      {activeSection === 'admin' && isAdmin && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
          <AdminDashboardSection />
        </div>
      )}

      {/* Modals */}
      <AvatarGalleryModal
        isOpen={showAvatarGallery}
        currentAvatarUrl={preferences.photoURL}
        displayName={preferences.displayName}
        onClose={() => setShowAvatarGallery(false)}
        onSave={handleSaveAvatar}
      />

      <DownloadManagerModal
        isOpen={showDownloadManager}
        onClose={() => setShowDownloadManager(false)}
        onPlayOffline={(item) => setOfflinePlayerItem(item)}
      />

      <OfflinePlayerModal
        item={offlinePlayerItem}
        onClose={() => setOfflinePlayerItem(null)}
      />
    </div>
  );
};

interface SettingsCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  badge?: string | number;
  onClick: () => void;
}

const SettingsCard: React.FC<SettingsCardProps> = ({
  icon: Icon,
  title,
  subtitle,
  badge,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="kuro-glass group relative flex items-start gap-4 rounded-3xl p-5 text-left transition-all duration-300 hover:border-violet-500/50 hover:bg-[#121526]/90 hover:shadow-[0_0_25px_-5px_rgba(147,51,234,0.3)]"
  >
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-purple-800/30 text-violet-300 border border-violet-500/30 transition-transform duration-300 group-hover:scale-110">
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-base font-bold text-white group-hover:text-violet-300 transition-colors">
          {title}
        </h3>
        {badge !== undefined && (
          <span className="shrink-0 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold text-violet-300 border border-violet-500/30">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{subtitle}</p>
    </div>
  </button>
);

const EmptySectionState: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="kuro-glass rounded-3xl p-12 text-center">
    <h3 className="text-base font-semibold text-white">{title}</h3>
    <p className="mt-1 text-sm text-slate-400">{description}</p>
    <Link
      to="/anime"
      className="kuro-btn-primary mt-4 inline-flex items-center rounded-2xl px-5 py-2 text-sm font-semibold"
    >
      Explore Anime Catalog
    </Link>
  </div>
);
