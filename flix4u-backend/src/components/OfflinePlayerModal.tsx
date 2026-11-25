import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls, {
  type HlsConfig,
  type Loader,
  type LoaderCallbacks,
  type LoaderConfiguration,
  type LoaderContext,
  type LoaderStats,
} from 'hls.js';
import {
  AlertTriangle,
  Gauge,
  HardDrive,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { isNativeCapacitorRuntime } from '@/src/config/env';
import { getOfflinePlaybackHandle, type DownloadItem } from '@/src/services/downloadService';
import {
  getOfflinePlaybackPosition,
  readBinaryChunk,
  saveOfflinePlaybackPosition,
  type OfflineManifestRecord,
} from '@/src/services/offlineStorage';

interface OfflinePlayerModalProps {
  item: DownloadItem | null;
  onClose: () => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function createOfflineHlsLoaderClass(
  downloadId: string,
  manifest: OfflineManifestRecord
): new (config: HlsConfig) => Loader<LoaderContext> {
  return class OfflineHlsLoader implements Loader<LoaderContext> {
    context: LoaderContext | null = null;
    stats: LoaderStats = {
      aborted: false,
      loaded: 0,
      retry: 0,
      total: 0,
      chunkCount: 0,
      bwEstimate: 20_000_000,
      loading: { start: 0, first: 0, end: 0 },
      parsing: { start: 0, end: 0 },
      buffering: { start: 0, first: 0, end: 0 },
    };
    private aborted = false;

    constructor(_config: HlsConfig) {
      // no network config needed for purely offline reads
    }

    destroy(): void {
      this.aborted = true;
      this.context = null;
    }

    abort(): void {
      this.aborted = true;
      this.stats.aborted = true;
    }

    getCacheAge(): number | null {
      return 0;
    }

    getResponseHeader(): string | null {
      return null;
    }

    load(
      context: LoaderContext,
      _config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>
    ): void {
      this.context = context;
      this.aborted = false;
      const startTime = performance.now();
      this.stats = {
        aborted: false,
        loaded: 0,
        retry: 0,
        total: 0,
        chunkCount: 1,
        bwEstimate: 25_000_000,
        loading: { start: startTime, first: startTime, end: startTime },
        parsing: { start: 0, end: 0 },
        buffering: { start: 0, first: 0, end: 0 },
      };

      const run = async () => {
        const url = context.url || '';
        if (url === 'kuro-offline://playlist') {
          const text = manifest.playlistText || '';
          if (!text) {
            callbacks.onError(
              { code: 404, text: 'Offline playlist missing' },
              context,
              null,
              this.stats
            );
            return;
          }
          const len = text.length;
          const doneTime = performance.now();
          this.stats.loaded = len;
          this.stats.total = len;
          this.stats.loading = { start: startTime, first: doneTime, end: doneTime };
          callbacks.onSuccess({ url, data: text }, this.stats, context, null);
          return;
        }

        let chunkKey = '';
        if (url.startsWith('kuro-offline://chunk/')) {
          chunkKey = url.slice('kuro-offline://chunk/'.length);
        }

        if (!chunkKey) {
          callbacks.onError(
            { code: 400, text: `Unsupported offline URL: ${url}` },
            context,
            null,
            this.stats
          );
          return;
        }

        const chunk = await readBinaryChunk(downloadId, chunkKey);
        if (this.aborted) {
          callbacks.onAbort?.(this.stats, context, null);
          return;
        }
        if (!chunk || chunk.bytes.byteLength === 0) {
          callbacks.onError(
            { code: 404, text: `Offline segment not found: ${chunkKey}` },
            context,
            null,
            this.stats
          );
          return;
        }

        const doneTime = performance.now();
        this.stats.loaded = chunk.bytes.byteLength;
        this.stats.total = chunk.bytes.byteLength;
        this.stats.loading = { start: startTime, first: doneTime, end: doneTime };

        if (context.responseType === 'text') {
          const textData = new TextDecoder().decode(chunk.bytes);
          callbacks.onSuccess({ url, data: textData }, this.stats, context, null);
          return;
        }

        const copy = new Uint8Array(chunk.bytes.byteLength);
        copy.set(chunk.bytes);
        callbacks.onSuccess({ url, data: copy.buffer }, this.stats, context, null);
      };

      void run().catch((err) => {
        if (this.aborted) return;
        callbacks.onError(
          {
            code: 500,
            text: err instanceof Error ? err.message : 'Failed reading offline chunk',
          },
          context,
          null,
          this.stats
        );
      });
    }
  };
}

export const OfflinePlayerModal: React.FC<OfflinePlayerModalProps> = ({ item, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const revokeRef = useRef<(() => void) | undefined>(undefined);
  const lastSavedWallRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);

  const effectiveFullscreen = isFullscreen || cssFullscreen;

  const persistPosition = useCallback(
    (timeSec: number, durSec: number) => {
      if (!item || !Number.isFinite(timeSec)) return;
      saveOfflinePlaybackPosition(item.id, timeSec, durSec);
    },
    [item]
  );

  const handleClose = useCallback(() => {
    const video = videoRef.current;
    if (video && item) {
      persistPosition(video.currentTime || 0, video.duration || 0);
    }
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.();
    } catch {
      // ignore
    }
    onClose();
  }, [item, onClose, persistPosition]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    const setup = async () => {
      setLoading(true);
      setError(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (revokeRef.current) {
        revokeRef.current();
        revokeRef.current = undefined;
      }

      try {
        const handle = await getOfflinePlaybackHandle(item);
        if (cancelled) {
          if (handle.mode === 'mp4') handle.revoke?.();
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        const savedPos = getOfflinePlaybackPosition(item.id);
        const startAt = savedPos?.currentTime || 0;

        const onMeta = () => {
          if (cancelled) return;
          const vidDur = video.duration || 0;
          setDuration(vidDur);
          if (startAt > 3 && (!vidDur || startAt < vidDur - 8)) {
            video.currentTime = startAt;
            setCurrentTime(startAt);
          }
          video.playbackRate = playbackRate;
          setLoading(false);
          setIsBuffering(false);
          video.play().catch(() => {});
        };

        video.addEventListener('loadedmetadata', onMeta, { once: true });

        if (handle.mode === 'mp4') {
          revokeRef.current = handle.revoke;
          video.src = handle.url;
        } else {
          if (!Hls.isSupported()) {
            throw new Error('Offline HLS playback requires MSE support in this WebView/browser.');
          }
          const OfflineLoader = createOfflineHlsLoaderClass(item.id, handle.manifest);
          const hls = new Hls({
            loader: OfflineLoader,
            enableWorker: !isNativeCapacitorRuntime(),
            lowLatencyMode: false,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          });
          hlsRef.current = hls;
          hls.loadSource('kuro-offline://playlist');
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!cancelled && data.fatal) {
              setLoading(false);
              setIsBuffering(false);
              setError(`Offline playback error (${data.details}). Try re-downloading this episode.`);
            }
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : 'Unable to open offline video file.');
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (revokeRef.current) {
        revokeRef.current();
        revokeRef.current = undefined;
      }
    };
  }, [item]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(video.duration || 0, (video.currentTime || 0) + delta));
    video.currentTime = next;
    setCurrentTime(next);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    if (!el) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const orientationApi = screen.orientation as
      | (ScreenOrientation & { lock?: (orientation: string) => Promise<void>; unlock?: () => void })
      | undefined;

    const currentlyFs = Boolean(
      document.fullscreenElement || doc.webkitFullscreenElement || cssFullscreen
    );

    if (!currentlyFs) {
      let entered = false;
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
          entered = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
          entered = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
        }
      } catch {
        entered = false;
      }
      if (!entered && video?.webkitEnterFullscreen) {
        try {
          video.webkitEnterFullscreen();
          entered = true;
        } catch {
          entered = false;
        }
      }
      if (!entered) setCssFullscreen(true);
      try {
        await orientationApi?.lock?.('landscape');
      } catch {
        // ignore orientation lock restrictions
      }
    } else {
      setCssFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } catch {
        // ignore
      }
      try {
        orientationApi?.unlock?.();
      } catch {
        // ignore
      }
    }
  }, [cssFullscreen]);

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      switch (e.key.toLowerCase()) {
        case 'escape':
          if (!effectiveFullscreen) handleClose();
          break;
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          seekBy(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          seekBy(10);
          break;
        case 'f':
          e.preventDefault();
          void toggleFullscreen();
          break;
        case 'm':
          if (videoRef.current) {
            e.preventDefault();
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, effectiveFullscreen, handleClose, togglePlay, seekBy, toggleFullscreen]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Offline Player — ${item.animeTitle}`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-xl"
    >
      <div
        ref={containerRef}
        className={`flex w-full flex-col overflow-hidden bg-[#06070d] shadow-2xl ${
          cssFullscreen
            ? 'fixed inset-0 z-[9999] h-screen w-screen rounded-none border-0'
            : isFullscreen
              ? 'h-full w-full rounded-none border-0'
              : 'max-w-5xl rounded-3xl border border-white/[0.12]'
        }`}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0a0c15]/95 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Offline Mode</span>
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-white">
                {item.animeTitle} — EP {item.episodeNumber}
              </h2>
              <p className="truncate text-xs text-slate-400">
                {item.episodeTitle} · {item.format.toUpperCase()} · {item.audioMode.toUpperCase()}
                {item.serverName ? ` · ${item.serverName}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close offline player"
            className="kuro-btn-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Surface */}
        <div className={`relative w-full bg-black ${effectiveFullscreen ? 'flex-1 min-h-0' : 'aspect-video'}`}>
          <video
            ref={videoRef}
            playsInline
            preload="auto"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPlaying={() => {
              setIsPlaying(true);
              setIsBuffering(false);
            }}
            onPause={() => {
              setIsPlaying(false);
              if (videoRef.current) {
                persistPosition(videoRef.current.currentTime || 0, videoRef.current.duration || 0);
              }
            }}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video) return;
              const nowSec = video.currentTime || 0;
              const durSec = video.duration || 0;
              setCurrentTime(nowSec);
              setDuration(durSec);
              const nowWall = Date.now();
              if (nowWall - lastSavedWallRef.current >= 4000) {
                lastSavedWallRef.current = nowWall;
                persistPosition(nowSec, durSec);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              if (videoRef.current) {
                persistPosition(videoRef.current.duration || 0, videoRef.current.duration || 0);
              }
            }}
            onError={() => {
              setLoading(false);
              setIsBuffering(false);
              setError('Failed to decode downloaded video file on this device.');
            }}
            className="h-full w-full cursor-pointer bg-black object-contain"
          />

          {(loading || isBuffering) && !error && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
              <Loader2 className="h-9 w-9 animate-spin text-violet-400" />
              <p className="text-xs font-medium text-slate-200">
                {loading ? 'Loading offline storage...' : 'Buffering...'}
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090b13]/95 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/35 bg-rose-500/15 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Offline Playback Failed</h3>
              <p className="mt-1.5 max-w-md text-xs sm:text-sm text-slate-300">{error}</p>
              <button
                type="button"
                onClick={handleClose}
                className="kuro-btn-primary mt-4 min-h-[44px] rounded-2xl px-5 py-2 text-xs font-semibold"
              >
                Close Player
              </button>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        {!error && (
          <div className="border-t border-white/[0.08] bg-[#0a0c15]/95 px-3.5 sm:px-5 py-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = next;
                setCurrentTime(next);
              }}
              aria-label="Seek offline video"
              className="mb-3 h-1.5 w-full cursor-pointer accent-violet-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="kuro-btn-primary flex h-11 w-11 items-center justify-center rounded-xl"
                >
                  {isPlaying ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  aria-label="Rewind 10 seconds"
                  className="kuro-btn-glass flex h-11 w-11 items-center justify-center rounded-xl"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  aria-label="Forward 10 seconds"
                  className="kuro-btn-glass flex h-11 w-11 items-center justify-center rounded-xl"
                >
                  <RotateCw className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!videoRef.current) return;
                    videoRef.current.muted = !videoRef.current.muted;
                    setIsMuted(videoRef.current.muted);
                  }}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="kuro-btn-glass flex h-11 w-11 items-center justify-center rounded-xl"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                    }
                    setIsMuted(v === 0);
                  }}
                  aria-label="Offline player volume"
                  className="hidden sm:block w-16 accent-violet-500"
                />

                <span className="ml-1 font-mono text-xs text-slate-300 tabular-nums">
                  {formatClock(currentTime)} / {formatClock(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Local Storage</span>
                </span>

                <label className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#121422] px-2.5 text-xs text-slate-200">
                  <Gauge className="h-3.5 w-3.5 text-violet-300" />
                  <select
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                    aria-label="Offline playback speed"
                    className="bg-transparent focus:outline-none"
                  >
                    {PLAYBACK_RATES.map((rate) => (
                      <option key={rate} value={rate} className="bg-[#10121a]">
                        {rate}x
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={effectiveFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  className="kuro-btn-glass flex h-11 w-11 items-center justify-center rounded-xl"
                >
                  {effectiveFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
