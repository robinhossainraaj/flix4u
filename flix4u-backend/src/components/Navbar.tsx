import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  Calendar,
  Download,
  Film,
  Home,
  LogIn,
  Menu,
  Package,
  Play,
  Search,
  Send,
  Server,
  Tv,
  User,
  X,
  Settings2,
  LogOut,
} from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { NotificationBell } from '@/src/components/NotificationBell';
import { handleTelegramSupportClick } from '@/src/components/TelegramSupportButton';
import { ASSETS } from '@/src/config/env';
import { useAuth } from '@/src/context/AuthContext';
import { useNotifications } from '@/src/context/NotificationContext';
import { useServer } from '@/src/context/ServerContext';
import { getDisplayTitle, searchAnime } from '@/src/services/anilistApi';
import { searchAnimeWorld } from '@/src/services/animeWorldApi';
import type { AnimeSummary, AnimeWorldItem } from '@/src/types/anime';

export const Navbar: React.FC = () => {
  const { user, preferences, openAuthModal, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { isAnimeWorld } = useServer();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [globalSuggestions, setGlobalSuggestions] = useState<AnimeSummary[]>([]);
  const [awSuggestions, setAwSuggestions] = useState<AnimeWorldItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGlobalSuggestions([]);
      setAwSuggestions([]);
      setSearching(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        if (isAnimeWorld) {
          const res = await searchAnimeWorld(trimmed, 1, { signal: controller.signal });
          if (!active || controller.signal.aborted) return;
          setAwSuggestions((res.results || []).slice(0, 6));
          setGlobalSuggestions([]);
        } else {
          const res = await searchAnime({ query: trimmed, perPage: 6, signal: controller.signal });
          if (!active || controller.signal.aborted) return;
          setGlobalSuggestions(res.items);
          setAwSuggestions([]);
        }
      } catch (err) {
        if (!active || controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        setGlobalSuggestions([]);
        setAwSuggestions([]);
      } finally {
        if (active && !controller.signal.aborted) setSearching(false);
      }
    }, 320);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, isAnimeWorld]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    setShowDropdown(false);
    setMobileMenuOpen(false);
    if (isAnimeWorld) {
      navigate(
        trimmed
          ? `/search?tab=search&q=${encodeURIComponent(trimmed)}`
          : '/search?tab=search'
      );
      return;
    }
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 text-sm font-medium transition-colors py-1.5 border-b-2 ${
      isActive
        ? 'text-white border-violet-500'
        : 'text-slate-300 border-transparent hover:text-white'
    }`;

  const hasCustomAvatar =
    Boolean(preferences.photoURL) && preferences.photoURL !== ASSETS.defaultAvatar;

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07080d]/85 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6 lg:gap-8">
        {/* Brand Zone */}
        <Link
          to="/"
          className="group flex items-center gap-2.5 sm:gap-3.5 whitespace-nowrap shrink-0 min-w-0 select-none"
          aria-label="Flix4U Home"
        >
          <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl overflow-hidden border border-violet-400/40 bg-[#12101f] kuro-brand-logo group-hover:scale-105 transition-transform duration-300">
            <img
              src="/assets/aistudio/file_00000000d64c8211a7a01231691e7256_8b4ae7b0.png"
              alt="Flix4U Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="font-display text-lg max-[359px]:text-base sm:text-2xl font-black tracking-[-0.02em] leading-none kuro-brand-text">
            Flix4U
          </span>
        </Link>

        {/* Desktop Nav Zone */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 shrink-0" aria-label="Main navigation">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/anime" className={navLinkClass}>
            Anime
          </NavLink>
          <NavLink to="/movies" className={navLinkClass}>
            Movies
          </NavLink>
          <NavLink to="/tv-series" className={navLinkClass}>
            TV Series
          </NavLink>
          <NavLink to="/animeworld-india" className={navLinkClass}>
            AnimeWorld<span className="hidden lg:inline"> India</span>
          </NavLink>
          <NavLink to="/schedule" className={navLinkClass}>
            Schedule
          </NavLink>
          <NavLink to="/community" className={navLinkClass}>
            Community
          </NavLink>
        </nav>

        {/* Search + Profile / Menu Action Zone */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2.5 md:flex-1 md:min-w-0">
          <div ref={searchContainerRef} className="relative w-full max-w-xs lg:max-w-sm hidden sm:block min-w-0">
            <form onSubmit={handleSubmit} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search anime..."
                aria-label="Search anime titles"
                className="h-10 w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-violet-500/70 focus:bg-[#10121e] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </form>

            {showDropdown && query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0e101a]/95 shadow-2xl backdrop-blur-2xl">
                {searching ? (
                  <div className="px-4 py-3 text-xs text-slate-400">
                    {isAnimeWorld ? 'Searching AnimeWorld India...' : 'Searching Flix4U Global...'}
                  </div>
                ) : isAnimeWorld ? (
                  awSuggestions.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400">
                      No matching anime found on AnimeWorld India. Press Enter for full search.
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/[0.06]">
                      {awSuggestions.map((item) => {
                        const target = item.seriesId
                          ? `/animeworld-india/series/${encodeURIComponent(item.seriesId)}`
                          : item.movieId
                            ? `/animeworld-india/watch/movie/${encodeURIComponent(item.movieId)}`
                            : '/anime';
                        return (
                          <li key={`${item.seriesId || item.movieId || item.title}`}>
                            <Link
                              to={target}
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.06] transition-colors"
                            >
                              <AnimeImage
                                src={item.image}
                                alt={item.title}
                                className="h-12 w-9 shrink-0 rounded-lg object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-100">
                                  {item.title}
                                </p>
                                <p className="truncate text-xs text-slate-400 tabular-nums">
                                  {[
                                    item.seriesId ? 'Series' : 'Movie',
                                    item.year,
                                    item.rating ? `★ ${item.rating}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                      <li>
                        <button
                          type="button"
                          onClick={handleSubmit}
                          className="w-full px-4 py-2.5 text-left text-xs font-medium text-violet-400 hover:bg-white/[0.04] transition-colors"
                        >
                          View all results for &ldquo;{query.trim()}&rdquo;
                        </button>
                      </li>
                    </ul>
                  )
                ) : globalSuggestions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400">
                    No matching anime found. Press Enter for full search.
                  </div>
                ) : (
                  <ul className="divide-y divide-white/[0.06]">
                    {globalSuggestions.map((anime) => {
                      const title = getDisplayTitle(anime.title);
                      return (
                        <li key={anime.id}>
                          <Link
                            to={`/anime/${anime.id}`}
                            onClick={() => setShowDropdown(false)}
                            className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.06] transition-colors"
                          >
                            <AnimeImage
                              src={anime.coverImage?.medium || anime.coverImage?.large}
                              alt={title}
                              className="h-12 w-9 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-100">{title}</p>
                              <p className="truncate text-xs text-slate-400 tabular-nums">
                                {[
                                  anime.format?.replace('_', ' '),
                                  anime.seasonYear,
                                  anime.episodes ? `${anime.episodes} Eps` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                    <li>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-violet-400 hover:bg-white/[0.04] transition-colors"
                      >
                        View all results for &ldquo;{query.trim()}&rdquo;
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>

          {user && <NotificationBell />}

          {user ? (
            <Link
              to="/profile"
              aria-label="Open profile"
              className="kuro-btn-glass flex h-9 w-9 sm:h-10 sm:w-auto sm:px-2.5 items-center justify-center gap-2 rounded-2xl text-sm font-medium whitespace-nowrap shrink-0"
            >
              <AnimeImage
                src={preferences.photoURL}
                alt={preferences.displayName}
                variant="avatar"
                className="h-6 w-6 rounded-full object-cover object-top ring-1 ring-violet-400/50"
              />
              <span className="hidden lg:inline max-w-[110px] truncate">
                {preferences.displayName}
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                to="/profile"
                aria-label="Profile avatar and library"
                className="kuro-btn-glass inline-flex h-9 w-9 sm:h-10 sm:w-auto sm:px-2.5 items-center justify-center gap-2 rounded-2xl text-sm font-medium whitespace-nowrap shrink-0"
              >
                {hasCustomAvatar ? (
                  <AnimeImage
                    src={preferences.photoURL}
                    alt={preferences.displayName}
                    variant="avatar"
                    className="h-6 w-6 rounded-full object-cover object-top ring-1 ring-violet-400/50"
                  />
                ) : (
                  <User className="h-4 w-4 text-violet-300" />
                )}
                <span className="hidden lg:inline">Profile</span>
              </Link>
              <button
                type="button"
                onClick={openAuthModal}
                className="kuro-btn-primary inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-2xl px-2.5 max-[359px]:px-2 sm:px-3.5 text-xs max-[359px]:text-[11px] font-semibold whitespace-nowrap shrink-0 sm:text-sm"
              >
                <LogIn className="h-3.5 w-3.5 max-[359px]:hidden sm:hidden" />
                <span>Sign In</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="kuro-btn-glass flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl md:hidden shrink-0"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Glass Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/[0.08] bg-[#0a0b13]/95 px-4 py-4 backdrop-blur-2xl md:hidden space-y-3.5">
          <form onSubmit={handleSubmit} className="relative sm:hidden">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime titles..."
              aria-label="Search anime titles"
              className="h-11 w-full rounded-2xl border border-white/[0.1] bg-white/[0.05] pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </form>

          {/* User Account Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 flex items-center gap-3">
            <AnimeImage
              src={preferences.photoURL}
              alt={preferences.displayName}
              variant="avatar"
              className="h-12 w-12 rounded-full object-cover ring-1 ring-violet-400/50"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{preferences.displayName}</p>
              <p className="truncate text-xs text-slate-400">
                {user ? user.email : 'Signed out / Guest'}
              </p>
            </div>
          </div>

          <nav className="grid grid-cols-1 gap-2.5" aria-label="Account menu">
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="kuro-btn-glass flex min-h-[46px] items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-300"
            >
              <Settings2 className="h-4 w-4" />
              <span>Settings</span>
            </Link>
            <Link
              to="/notifications"
              onClick={() => setMobileMenuOpen(false)}
              className="kuro-btn-glass flex min-h-[46px] items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-200"
            >
              <span className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-violet-300" />
                <span>Notifications</span>
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="kuro-btn-glass flex min-h-[46px] items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-200"
            >
              <User className="h-4 w-4 text-violet-300" />
              <span>User Profile &amp; Library</span>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleTelegramSupportClick(e);
              }}
              className="kuro-btn-glass flex min-h-[46px] items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-cyan-300 hover:text-cyan-200 border-cyan-500/30 bg-cyan-500/10"
            >
              <Send className="h-4 w-4 shrink-0 text-cyan-400" />
              <div className="flex-1 text-left">
                <span className="block font-semibold">Contact Support</span>
                <span className="block text-[11px] text-slate-400">Telegram: @rifat_hossain125</span>
              </div>
            </button>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                className="kuro-btn-glass flex min-h-[46px] items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-rose-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal();
                }}
                className="kuro-btn-primary flex min-h-[46px] items-center justify-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In / Create Account</span>
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
