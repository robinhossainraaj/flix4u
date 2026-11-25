import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDown, CheckCircle2, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { subscribeAppUpdateConfig, type AppUpdateConfig, CURRENT_CLIENT_VERSION_CODE } from '@/src/services/updateService';

interface AppUpdateModalProps {
  previewConfig?: AppUpdateConfig | null;
  onClosePreview?: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  previewConfig = null,
  onClosePreview,
}) => {
  const [config, setConfig] = useState<AppUpdateConfig | null>(previewConfig);
  const [loadingConfig, setLoadingConfig] = useState(!previewConfig);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (previewConfig) {
      setConfig(previewConfig);
      setLoadingConfig(false);
      return;
    }

    const unsub = subscribeAppUpdateConfig(
      (c) => {
        setConfig(c);
        setLoadingConfig(false);
      },
      () => setLoadingConfig(false)
    );
    return () => unsub();
  }, [previewConfig]);

  if (loadingConfig || !config || !config.enabled) {
    if (!previewConfig) return null;
  }

  const isPreview = Boolean(previewConfig);
  const ignoredKey = `flix4u_ignored_update_${config?.latestVersion}`;
  const isIgnored = !isPreview && !config?.mandatory && localStorage.getItem(ignoredKey) === 'true';

  if (!isPreview && (dismissed || isIgnored)) {
    if (!config?.enabled || config.versionCode <= CURRENT_CLIENT_VERSION_CODE) {
      return null;
    }
  }

  // Determine if popup should display automatically
  const shouldShow =
    isPreview ||
    (config?.enabled && config.versionCode > CURRENT_CLIENT_VERSION_CODE && !dismissed && !isIgnored);

  if (!shouldShow) return null;
  if (!config) return null;

  const handleLater = () => {
    if (isPreview) {
      if (onClosePreview) onClosePreview();
      return;
    }
    if (config?.mandatory) return; // Cannot dismiss mandatory updates
    if (config?.latestVersion) {
      localStorage.setItem(`flix4u_ignored_update_${config.latestVersion}`, 'true');
    }
    setDismissed(true);
  };

  const handleUpdateNow = () => {
    if (!config?.apkUrl) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    // Simulate smooth APK download progress
    let current = 0;
    const interval = window.setInterval(() => {
      current += Math.floor(Math.random() * 18) + 12;
      if (current >= 100) {
        current = 100;
        window.clearInterval(interval);
        setDownloadProgress(100);
        setDownloadComplete(true);

        // Open APK download URL / trigger package installer intent
        try {
          const newWindow = window.open(config.apkUrl, '_blank', 'noopener,noreferrer');
          if (newWindow) newWindow.opener = null;
        } catch {
          window.location.href = config.apkUrl;
        }
      } else {
        setDownloadProgress(current);
      }
    }, 280);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App Update Available"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
    >
      <div className="kuro-glass relative w-full max-w-lg overflow-hidden rounded-3xl border border-violet-500/40 bg-[#0d101d] p-6 sm:p-8 shadow-[0_25px_80px_-15px_rgba(139,92,246,0.65)]">
        {/* Ambient background aura */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl"
        />

        {!config.mandatory && !isPreview && (
          <button
            type="button"
            onClick={handleLater}
            aria-label="Close update modal"
            className="kuro-btn-glass absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Animated Flix4U Logo / Update Icon */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-400/50 bg-gradient-to-br from-violet-600/30 via-[#141728] to-fuchsia-600/30 shadow-[0_0_35px_rgba(168,85,247,0.5)] animate-bounce-slow">
            <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-[#0d101d]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <img
              src="/assets/aistudio/file_00000000d64c8211a7a01231691e7256_8b4ae7b0.png"
              alt="Flix4U Logo"
              className="h-12 w-12 rounded-2xl object-cover"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-200 tabular-nums">
              Version {config.latestVersion}
            </span>
            {config.mandatory && (
              <span className="rounded-full border border-rose-400/50 bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-200">
                Mandatory Update
              </span>
            )}
            {isPreview && (
              <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200">
                Admin Preview Mode
              </span>
            )}
          </div>

          <h2 className="mt-2 text-xl sm:text-2xl font-black text-white tracking-tight">
            {config.title || 'New Flix4U Update Available'}
          </h2>

          {config.description && (
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md">
              {config.description}
            </p>
          )}

          {/* Release Notes */}
          {config.releaseNotes && (
            <div className="mt-4 w-full max-h-40 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#070913]/90 p-4 text-left">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-violet-400 mb-1.5">
                Release Notes
              </span>
              <div className="whitespace-pre-line text-xs text-slate-300 font-mono leading-relaxed">
                {config.releaseNotes}
              </div>
            </div>
          )}

          {/* Downloading state */}
          {downloading && (
            <div className="mt-5 w-full space-y-2 rounded-2xl border border-violet-400/40 bg-[#090b14] p-4 text-left">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span className="flex items-center gap-2">
                  {!downloadComplete ? (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  <span>
                    {downloadComplete ? 'APK Download Ready' : 'Downloading Flix4U APK...'}
                  </span>
                </span>
                <span className="font-mono text-violet-300 tabular-nums">{downloadProgress}%</span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>

              {downloadComplete && (
                <p className="text-[11px] text-emerald-300 font-medium">
                  Opening Android package installer... If download did not start automatically, click below.
                </p>
              )}
            </div>
          )}

          {downloadError && (
            <p className="mt-3 text-xs font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{downloadError}</span>
            </p>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              type="button"
              disabled={downloading && !downloadComplete}
              onClick={handleUpdateNow}
              className="kuro-btn-primary inline-flex min-h-[48px] w-full flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/60 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {downloading && !downloadComplete ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Downloading ({downloadProgress}%)</span>
                </>
              ) : downloadComplete ? (
                <>
                  <ExternalLink className="h-5 w-5" />
                  <span>Open APK / Re-download</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>{config.buttonText || 'Update Now'}</span>
                </>
              )}
            </button>

            {(!config.mandatory || isPreview) && (
              <button
                type="button"
                onClick={handleLater}
                className="kuro-btn-glass inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-2xl px-5 py-3 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white"
              >
                <span>Later</span>
              </button>
            )}
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            Secure Flix4U APK updater · Preserves logins, watch history &amp; preferences.
          </p>
        </div>
      </div>
    </div>
  );
};
