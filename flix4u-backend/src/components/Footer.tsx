import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Settings2 } from 'lucide-react';
import {
  getDefaultStreamingApiBase,
  getStreamingApiBase,
  setStreamingApiOverride,
} from '@/src/config/env';

export const Footer: React.FC = () => {
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [endpointInput, setEndpointInput] = useState(() => getStreamingApiBase());
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    setStreamingApiOverride(endpointInput);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleResetEndpoint = () => {
    setStreamingApiOverride(null);
    setEndpointInput(getDefaultStreamingApiBase());
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <footer className="mt-16 border-t border-white/[0.08] bg-[#05060a] pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link
              to="/"
              className="group inline-flex items-center gap-2.5 text-xl font-black tracking-tight"
              aria-label="Flix4U Home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 text-white shadow-[0_0_18px_-2px_rgba(147,51,234,0.5)] transition-transform duration-200 group-hover:scale-105">
                <Play className="h-4 w-4 translate-x-0.5 fill-current" />
              </span>
              <span className="font-display text-xl font-black tracking-[-0.02em] drop-shadow-[0_0_14px_rgba(168,85,247,0.4)]">
                <span className="text-white">Kuro</span>
                <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent">Stream</span>
              </span>
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Curated dark-cinema anime discovery and adaptive streaming platform powered by
              AniList metadata, HLS.js playback, and real-time watchlist sync.
            </p>
            <button
              type="button"
              onClick={() => setEndpointOpen((v) => !v)}
              className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-violet-400 transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Configure Streaming Provider Endpoint</span>
            </button>

            {endpointOpen && (
              <form
                onSubmit={handleSaveEndpoint}
                className="mt-3 max-w-md rounded-xl border border-white/[0.08] bg-[#10121a] p-3.5"
              >
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Streaming API Base URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    placeholder="https://ashanime-api.vercel.app"
                    className="flex-1 rounded-lg border border-white/[0.08] bg-[#08090d] px-3 py-1.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleResetEndpoint}
                    className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05] transition-colors"
                  >
                    Reset
                  </button>
                </div>
                {savedNotice && (
                  <p className="mt-2 text-xs text-emerald-400">
                    Endpoint updated. Reload or switch episode to fetch from the new provider.
                  </p>
                )}
              </form>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/movies" className="hover:text-white transition-colors">
                  Anime Movies
                </Link>
              </li>
              <li>
                <Link to="/tv-series" className="hover:text-white transition-colors">
                  TV Series
                </Link>
              </li>
              <li>
                <Link to="/animeworld-india" className="hover:text-white transition-colors">
                  AnimeWorld India
                </Link>
              </li>
              <li>
                <Link to="/schedule" className="hover:text-white transition-colors">
                  Airing Schedule
                </Link>
              </li>
              <li>
                <Link to="/search" className="hover:text-white transition-colors">
                  Browse &amp; Filter
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Genres &amp; Account</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/search?genre=Action" className="hover:text-white transition-colors">
                  Action
                </Link>
              </li>
              <li>
                <Link to="/search?genre=Fantasy" className="hover:text-white transition-colors">
                  Fantasy
                </Link>
              </li>
              <li>
                <Link to="/search?genre=Sci-Fi" className="hover:text-white transition-colors">
                  Sci-Fi
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-white transition-colors">
                  Watchlist &amp; History
                </Link>
              </li>
              <li>
                <Link to="/profile?tab=sources" className="hover:text-white transition-colors">
                  Sources &amp; Extensions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Flix4U. Metadata provided by AniList.</p>
          <p>Respects external streaming provider permissions and copyright.</p>
        </div>
      </div>
    </footer>
  );
};
