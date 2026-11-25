import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import {
  fetchExtensionsCatalog,
  getEnabledExtensionIds,
  toggleCompatibleExtension,
} from '@/src/services/extensionsApi';
import type { ExtensionRepoItem, ExtensionsCatalogResponse } from '@/src/types/anime';

type RepoFilter = 'all' | 'compatible' | 'aniyomi' | 'tachiyomi';

export const ExtensionManager: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [catalog, setCatalog] = useState<ExtensionsCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RepoFilter>('all');
  const [showNsfw, setShowNsfw] = useState(false);
  const [enabledIds, setEnabledIds] = useState<string[]>(() => getEnabledExtensionIds());
  const [notice, setNotice] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExtensionsCatalog();
      setCatalog(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch extension repositories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const handleToggle = (ext: ExtensionRepoItem) => {
    const res = toggleCompatibleExtension(ext, enabledIds);
    if (res.error) {
      setNotice(`${ext.name}: ${res.error}`);
      return;
    }
    setNotice(null);
    setEnabledIds(res.next);
  };

  const filteredExtensions = useMemo(() => {
    const list = catalog?.extensions || [];
    const q = search.trim().toLowerCase();
    return list
      .filter((ext) => {
        if (!showNsfw && ext.nsfw) return false;
        if (filter === 'compatible' && !ext.compatible) return false;
        if (filter === 'aniyomi' && ext.repoType !== 'aniyomi') return false;
        if (filter === 'tachiyomi' && ext.repoType !== 'tachiyomi') return false;
        if (!q) return true;
        return (
          ext.name.toLowerCase().includes(q) ||
          ext.pkg.toLowerCase().includes(q) ||
          ext.lang.toLowerCase().includes(q) ||
          ext.sources.some(
            (s) =>
              s.name.toLowerCase().includes(q) || s.baseUrl.toLowerCase().includes(q)
          )
        );
      })
      .slice(0, compact ? 40 : 120);
  }, [catalog, search, filter, showNsfw, compact]);

  return (
    <div className="space-y-5">
      {/* Repository Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(catalog?.repositories || []).map((repo) => (
          <div
            key={repo.id}
            className="rounded-2xl border border-white/[0.08] bg-[#10121a] p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">{repo.name}</h3>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-violet-400 break-all"
                >
                  <span className="truncate max-w-[280px] sm:max-w-[360px]">{repo.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <span
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  repo.status === 'ok'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {repo.status === 'ok' ? 'Connected' : 'Error'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-300 tabular-nums">
              <span>{repo.totalCount} extensions indexed</span>
              <span className="text-violet-300 font-medium">
                {repo.compatibleCount} web-adapted
              </span>
            </div>
            {repo.error && <p className="text-xs text-rose-400">{repo.error}</p>}
          </div>
        ))}
      </div>

      {/* Honest Runtime Compatibility Info */}
      <div className="flex items-start gap-3 rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4 text-xs leading-relaxed text-slate-300">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
        <div>
          <p className="font-semibold text-white">Runtime Compatibility Check</p>
          <p className="mt-0.5">
            Aniyomi &amp; Tachiyomi repositories distribute Android <code className="text-violet-300">.apk</code>{' '}
            extensions built for Dalvik/JVM. Web browsers cannot run Android APK bytecode directly.
            Supported Aniyomi video sources (HiAnime, AniWatchtv, Kaido, AnimePahe, AnimeOnsen,
            AniZone) use Flix4U&apos;s Node.js backend adapter to extract real HLS streams;
            APK-only extensions and Tachiyomi manga packages remain locked with their runtime
            limitation reported below.
          </p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-2.5 text-xs text-amber-200">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="kuro-btn-glass rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search extension name, package, or source URL..."
            aria-label="Search extensions"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#10121a] pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'compatible', 'aniyomi', 'tachiyomi'] as RepoFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize ${
                filter === f ? 'kuro-btn-active' : 'kuro-btn-glass text-slate-300'
              }`}
            >
              {f === 'compatible' ? 'Compatible' : f}
            </button>
          ))}

          <label className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#10121a] px-3 py-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showNsfw}
              onChange={(e) => setShowNsfw(e.target.checked)}
              className="accent-violet-500"
            />
            <span>18+</span>
          </label>

          <button
            type="button"
            onClick={loadRepos}
            disabled={loading}
            className="kuro-btn-glass inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Extensions List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#10121a] py-12 text-sm text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          <span>Fetching Aniyomi &amp; Tachiyomi extension repositories...</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-center text-sm text-rose-300">
          <AlertCircle className="mx-auto h-6 w-6 mb-2" />
          <p>{error}</p>
        </div>
      ) : filteredExtensions.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#10121a] p-8 text-center text-sm text-slate-400">
          No extensions match your current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredExtensions.map((ext) => {
            const isEnabled = ext.compatible && enabledIds.includes(ext.id);
            return (
              <div
                key={ext.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  isEnabled
                    ? 'border-violet-500/50 bg-[#131522]'
                    : 'border-white/[0.08] bg-[#10121a]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="h-4 w-4 text-violet-400 shrink-0" />
                      <h4 className="truncate text-sm font-bold text-white">{ext.name}</h4>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                        v{ext.version}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] uppercase text-slate-400">
                        {ext.lang}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{ext.pkg}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggle(ext)}
                    className={`min-h-[36px] shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold ${
                      ext.compatible
                        ? isEnabled
                          ? 'kuro-btn-primary'
                          : 'kuro-btn-active'
                        : 'kuro-btn-glass text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {ext.compatible
                      ? isEnabled
                        ? 'Enabled'
                        : 'Enable'
                      : 'Incompatible'}
                  </button>
                </div>

                {/* Sources inside Extension */}
                {ext.sources.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {ext.sources.slice(0, 4).map((src) => (
                      <span
                        key={src.id || `${src.name}-${src.lang}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-[#08090d] px-2 py-1 text-[11px] text-slate-300"
                        title={src.baseUrl}
                      >
                        <span>{src.name}</span>
                        {src.baseUrl && (
                          <span className="text-slate-500 truncate max-w-[140px]">
                            ({src.baseUrl.replace(/^https?:\/\//, '')})
                          </span>
                        )}
                      </span>
                    ))}
                    {ext.sources.length > 4 && (
                      <span className="rounded-lg px-2 py-1 text-[11px] text-slate-500">
                        +{ext.sources.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Compatibility Status Detail */}
                <div className="mt-3 flex items-start gap-2 border-t border-white/[0.06] pt-2.5 text-xs">
                  {ext.compatibility === 'adapted' ? (
                    <>
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="text-emerald-300/90">{ext.limitationReason}</span>
                    </>
                  ) : ext.compatibility === 'android-runtime-required' ? (
                    <>
                      <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-slate-400">{ext.limitationReason}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                      <span className="text-rose-300/90">{ext.limitationReason}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
