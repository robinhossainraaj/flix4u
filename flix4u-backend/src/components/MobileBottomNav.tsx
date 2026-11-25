import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, MotionConfig } from 'motion/react';
import { Bookmark, Film, Home, Search, User } from 'lucide-react';

interface NavTabItem {
  id: 'home' | 'anime' | 'search' | 'watchlist' | 'profile';
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const MOBILE_TABS: NavTabItem[] = [
  { id: 'home', label: 'Home', to: '/', icon: Home },
  { id: 'anime', label: 'Anime', to: '/anime', icon: Film },
  { id: 'search', label: 'Search', to: '/search', icon: Search },
  { id: 'watchlist', label: 'Watchlist', to: '/profile?tab=watchlist', icon: Bookmark },
  { id: 'profile', label: 'Profile', to: '/profile', icon: User },
];

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };

    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  // Hide automatically when video player enters fullscreen mode
  if (isFullscreen) return null;

  const activeTabId = (() => {
    const { pathname, search } = location;
    if (pathname === '/') return 'home';
    if (
      pathname === '/anime' ||
      pathname === '/movies' ||
      pathname === '/tv-series' ||
      pathname.startsWith('/anime/') ||
      pathname.startsWith('/animeworld-india')
    ) {
      return 'anime';
    }
    if (pathname === '/search') return 'search';
    if (pathname === '/profile') {
      const params = new URLSearchParams(search);
      return params.get('tab') === 'watchlist' ? 'watchlist' : 'profile';
    }
    if (pathname.startsWith('/watch/')) return 'anime';
    return 'home';
  })();

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 sm:px-6"
        style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}
      >
        <nav
          aria-label="Bottom navigation"
          className="kuro-dock-pill pointer-events-auto relative mx-auto grid w-full max-w-[min(376px,calc(100vw-1rem))] sm:max-w-[420px] md:max-w-[440px] grid-cols-5 items-center rounded-full px-1.5 py-1.5 sm:px-3.5 sm:py-2.5 [@media(max-height:480px)]:py-1"
        >
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTabId === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.label}
                className="group relative flex flex-col items-center justify-center gap-1 py-0.5 select-none focus-visible:outline-none [@media(max-height:480px)]:gap-0.5"
              >
                <span className="relative flex h-10 w-10 max-[359px]:h-9 max-[359px]:w-9 sm:h-12 sm:w-12 [@media(max-height:480px)]:h-8 [@media(max-height:480px)]:w-8 items-center justify-center rounded-full transition-transform duration-150 ease-out group-active:scale-[0.92] group-focus-visible:ring-2 group-focus-visible:ring-violet-400">
                  <span
                    aria-hidden="true"
                    className="kuro-dock-orb-idle absolute inset-0 rounded-full group-hover:border-white/[0.14]"
                  />

                  {active && (
                    <motion.span
                      layoutId="kuro-dock-active-orb"
                      transition={{
                        type: 'spring',
                        stiffness: 440,
                        damping: 32,
                        mass: 0.78,
                      }}
                      aria-hidden="true"
                      className="kuro-dock-orb-active absolute inset-0 rounded-full"
                    />
                  )}

                  <Icon
                    strokeWidth={active ? 2.1 : 1.6}
                    className={`relative z-10 h-[18px] w-[18px] sm:h-5 sm:w-5 [@media(max-height:480px)]:h-4 [@media(max-height:480px)]:w-4 transition-colors duration-200 ${
                      active
                        ? 'text-white'
                        : 'text-slate-300/80 group-hover:text-white'
                    }`}
                  />
                </span>

                <span
                  className={`text-[10px] max-[359px]:text-[9.5px] sm:text-[10.5px] leading-none tracking-tight whitespace-nowrap transition-colors duration-200 [@media(max-height:480px)]:hidden ${
                    active
                      ? 'font-semibold text-white'
                      : 'font-medium text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </MotionConfig>
  );
};
