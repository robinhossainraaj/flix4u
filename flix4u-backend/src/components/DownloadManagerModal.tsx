import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  HardDrive,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { OfflinePlayerModal } from '@/src/components/OfflinePlayerModal';
import {
  cancelOrDeleteDownload,
  getStoredDownloads,
  pauseDownload,
  resumeDownload,
  retryDownload,
  type DownloadItem,
} from '@/src/services/downloadService';

interface DownloadManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayOffline?: (item: DownloadItem) => void;
}

export function formatDownloadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  if (mb < 0.1) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function formatDownloadSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 KB/s';
  const kb = bytesPerSec / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB/s`;
  }
  return `${Math.round(kb)} KB/s`;
}

export const DownloadManagerModal: React.FC<DownloadManagerModalProps> = ({
  isOpen,
  onClose,
  onPlayOffline,
}) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [internalOfflineItem, setInternalOfflineItem] = useState<DownloadItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const load = () => {
      setDownloads(getStoredDownloads());
    };
    load();
    window.addEventListener('flix4u:downloads-updated', load);
    const timer = window.setInterval(load, 800);
    return () => {
      window.removeEventListener('flix4u:downloads-updated', load);
      window.clearInterval(timer);
    };
  }, [isOpen]);

  const stats = useMemo(() => {
    let totalBytes = 0;
    let completedCount = 0;
    let activeCount = 0;
    for (const d of downloads) {
      totalBytes += d.status === 'completed' ? d.fileSize || d.downloadedBytes : d.downloadedBytes;
      if (d.status === 'completed') completedCount += 1;
      if (d.status === 'downloading' || d.status === 'queued') activeCount += 1;
    }
    return { totalBytes, completedCount, activeCount };
  }, [downloads]);

  if (!isOpen && !internalOfflineItem) return null;

  const handlePlay = (item: DownloadItem) => {
    if (onPlayOffline) {
      onPlayOffline(item);
      onClose();
    } else {
      setInternalOfflineItem(item);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Download Manager"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md"
        >
          <div className="kuro-glass-elevated flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 sm:px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-600/15 text-violet-300">
                  <Download className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-white">
                    Download Manager &amp; Offline
                  </h2>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 tabular-nums">
                    <span>{stats.completedCount} offline ready</span>
                    {stats.activeCount > 0 && (
                      <span className="text-violet-300">· {stats.activeCount} active</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      · <HardDrive className="h-3 w-3" /> {formatDownloadBytes(stats.totalBytes)}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close download manager"
                className="kuro-btn-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {downloads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400">
                    <Download className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No Downloads Yet</h3>
                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    Tap Download on any anime episode or video player control bar to save it for offline viewing.
                  </p>
                </div>
              ) : (
                downloads.map((item) => {
                  const isCompleted = item.status === 'completed';
                  const isDownloading = item.status === 'downloading';
                  const isQueued = item.status === 'queued';
                  const isError = item.status === 'error';
                  const isPaused = item.status === 'paused';
                  const isUnsupported = item.status === 'unsupported';

                  return (
                    <div
                      key={item.id}
                      className="kuro-glass flex flex-col gap-3 rounded-2xl p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        {item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt={item.animeTitle}
                            className="h-16 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-slate-400 ring-1 ring-white/10">
                            <Download className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-violet-300 tabular-nums">
                            <span className="font-semibold uppercase tracking-wider">
                              EP {item.episodeNumber} · {item.audioMode.toUpperCase()}
                            </span>
                            <span className="uppercase text-slate-400">
                              · {item.format}
                              {item.serverName ? ` (${item.serverName})` : ''}
                            </span>
                            <span className="text-slate-400">
                              · {formatDownloadBytes(item.fileSize || item.downloadedBytes)}
                            </span>
                            {isDownloading && item.speedBytesPerSec > 0 && (
                              <span className="text-emerald-400">
                                · {formatDownloadSpeed(item.speedBytesPerSec)}
                              </span>
                            )}
                          </div>
                          <h4 className="truncate text-xs sm:text-sm font-bold text-white">
                            {item.animeTitle}
                          </h4>
                          <p className="truncate text-xs text-slate-400">{item.episodeTitle}</p>

                          {(isDownloading || isPaused || isQueued) && (
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  {isQueued && <Clock className="h-3 w-3 text-amber-300" />}
                                  <span>
                                    {isQueued
                                      ? 'Queued...'
                                      : isDownloading
                                        ? 'Downloading...'
                                        : 'Paused'}{' '}
                                    ({item.progress}%)
                                    {item.totalSegments
                                      ? ` · ${item.completedSegments || 0}/${item.totalSegments} segs`
                                      : ''}
                                  </span>
                                </span>
                                <span>
                                  {formatDownloadBytes(item.downloadedBytes)}
                                  {item.fileSize > 0
                                    ? ` / ${formatDownloadBytes(item.fileSize)}`
                                    : ''}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                                  style={{ width: `${Math.max(2, item.progress)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {isUnsupported && (
                            <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-300">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="line-clamp-2">
                                {item.errorMessage ||
                                  'Download Not Supported: Embed-only or DRM-protected stream.'}
                              </span>
                            </p>
                          )}

                          {isError && (
                            <p className="mt-1 flex items-start gap-1 text-[11px] text-rose-400">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="line-clamp-2">
                                {item.errorMessage || 'Download failed'}
                              </span>
                            </p>
                          )}

                          {isCompleted && (
                            <p className="flex items-center gap-1 text-[11px] text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Saved offline · Works without internet</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions (44x44 minimum mobile touch targets) */}
                      <div className="flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0">
                        {isUnsupported && (
                          <span className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200">
                            Download Not Supported
                          </span>
                        )}
                        {(isDownloading || isQueued) && (
                          <button
                            type="button"
                            onClick={() => {
                              pauseDownload(item.id);
                              setDownloads(getStoredDownloads());
                            }}
                            className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            <span>Pause</span>
                          </button>
                        )}

                        {isPaused && (
                          <button
                            type="button"
                            onClick={() => {
                              resumeDownload(item.id);
                              setDownloads(getStoredDownloads());
                            }}
                            className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Resume</span>
                          </button>
                        )}

                        {isError && (
                          <button
                            type="button"
                            onClick={() => {
                              void retryDownload(item.id).then(() =>
                                setDownloads(getStoredDownloads())
                              );
                            }}
                            className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Retry</span>
                          </button>
                        )}

                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => handlePlay(item)}
                            className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>Play Offline</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            void cancelOrDeleteDownload(item.id).then(() =>
                              setDownloads(getStoredDownloads())
                            );
                          }}
                          aria-label={isCompleted ? 'Delete downloaded episode' : 'Cancel download'}
                          title={isCompleted ? 'Delete from device' : 'Cancel download'}
                          className="kuro-btn-glass flex h-11 w-11 items-center justify-center rounded-xl text-rose-300 hover:text-rose-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <OfflinePlayerModal
        item={internalOfflineItem}
        onClose={() => setInternalOfflineItem(null)}
      />
    </>
  );
};
