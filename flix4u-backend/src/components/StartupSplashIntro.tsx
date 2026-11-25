import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const INTRO_SESSION_KEY = 'flix4u_startup_intro_seen_v1';
const LOGO_SRC = '/assets/aistudio/file_00000000d64c8211a7a01231691e7256_8b4ae7b0.png';

interface ParticleSpec {
  id: number;
  left: string;
  bottom: string;
  size: number;
  delay: string;
  duration: string;
  color: 'purple' | 'magenta';
}

interface OrbitalParticleSpec {
  id: number;
  left: string;
  top: string;
  size: number;
  delay: string;
  tx: string;
  ty: string;
  color: 'purple' | 'magenta';
}

// Fast ambient glow particles (no expensive box-shadow blur passes)
const AMBIENT_PARTICLES: ParticleSpec[] = [
  { id: 1, left: '14%', bottom: '18%', size: 4, delay: '0.00s', duration: '0.9s', color: 'purple' },
  { id: 2, left: '28%', bottom: '14%', size: 4, delay: '0.06s', duration: '0.9s', color: 'magenta' },
  { id: 3, left: '46%', bottom: '12%', size: 4, delay: '0.04s', duration: '0.9s', color: 'purple' },
  { id: 4, left: '66%', bottom: '15%', size: 4, delay: '0.08s', duration: '0.9s', color: 'magenta' },
  { id: 5, left: '82%', bottom: '20%', size: 4, delay: '0.05s', duration: '0.9s', color: 'purple' },
  { id: 6, left: '18%', bottom: '68%', size: 3, delay: '0.10s', duration: '0.85s', color: 'magenta' },
];

// Subtle accent particles around the centered logo during reveal
const ORBITAL_PARTICLES: OrbitalParticleSpec[] = [
  { id: 1, left: '10%', top: '20%', size: 4, delay: '0.24s', tx: '-14px', ty: '-16px', color: 'purple' },
  { id: 2, left: '90%', top: '22%', size: 4, delay: '0.28s', tx: '16px', ty: '-14px', color: 'magenta' },
  { id: 3, left: '8%', top: '76%', size: 3, delay: '0.32s', tx: '-16px', ty: '12px', color: 'magenta' },
  { id: 4, left: '92%', top: '74%', size: 4, delay: '0.35s', tx: '16px', ty: '12px', color: 'purple' },
];

let hasPlayedInCurrentProcess = false;

function shouldShowIntroOnLaunch(): boolean {
  if (typeof window === 'undefined') return false;
  if (hasPlayedInCurrentProcess) return false;

  try {
    if (window.sessionStorage.getItem(INTRO_SESSION_KEY) === '1') {
      return false;
    }
  } catch {
    // ignore storage errors
  }

  return true;
}

export const StartupSplashIntro: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() => shouldShowIntroOnLaunch());
  const [exiting, setExiting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!visible) return;

    hasPlayedInCurrentProcess = true;
    try {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch {
      // ignore storage errors
    }

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const prefersReduced = Boolean(mediaQuery?.matches);
    setReducedMotion(prefersReduced);

    // Crisp, fast ~1.0s startup intro so Home content appears immediately
    const exitStartMs = prefersReduced ? 240 : 680;
    const unmountMs = prefersReduced ? 440 : 1020;

    const exitTimer = window.setTimeout(() => {
      setExiting(true);
    }, exitStartMs);

    const doneTimer = window.setTimeout(() => {
      setVisible(false);
    }, unmountMs);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#000000] select-none ${
        exiting ? 'pointer-events-none kuro-splash-exit' : ''
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Subtle purple and magenta atmospheric neon depth on pure black */}
      <div
        className={`pointer-events-none absolute -left-24 -top-24 h-[62vmax] w-[62vmax] rounded-full ${
          reducedMotion ? 'opacity-25' : 'kuro-splash-atmosphere'
        }`}
        style={{
          background:
            'radial-gradient(circle, rgba(147, 51, 234, 0.28) 0%, rgba(126, 34, 206, 0.1) 42%, rgba(0, 0, 0, 0) 72%)',
        }}
      />
      <div
        className={`pointer-events-none absolute -bottom-24 -right-24 h-[62vmax] w-[62vmax] rounded-full ${
          reducedMotion ? 'opacity-20' : 'kuro-splash-atmosphere'
        }`}
        style={{
          background:
            'radial-gradient(circle, rgba(217, 70, 239, 0.24) 0%, rgba(190, 24, 93, 0.1) 42%, rgba(0, 0, 0, 0) 72%)',
        }}
      />

      {/* Ambient particles (GPU transform/opacity only) */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {AMBIENT_PARTICLES.map((p) => {
            const bg =
              p.color === 'magenta' ? 'rgba(232, 121, 249, 0.85)' : 'rgba(168, 85, 247, 0.85)';
            return (
              <span
                key={p.id}
                className="kuro-splash-particle absolute rounded-full"
                style={{
                  left: p.left,
                  bottom: p.bottom,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  backgroundColor: bg,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Fast purple neon light sweep */}
      {!reducedMotion && (
        <div className="kuro-splash-sweep pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <div
            className="h-[140vh] w-28 sm:w-36 -rotate-12"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(147, 51, 234, 0.16) 32%, rgba(217, 70, 239, 0.34) 50%, rgba(168, 85, 247, 0.28) 58%, transparent 100%)',
            }}
          />
        </div>
      )}

      {/* Center Stage: Official Flix4U Logo + Glow + Tagline */}
      <div className="relative z-10 flex flex-col items-center px-6">
        <div className="relative aspect-square w-48 sm:w-56">
          <div
            className={`pointer-events-none absolute -inset-8 rounded-full ${
              reducedMotion ? 'opacity-30' : 'kuro-splash-halo'
            }`}
            style={{
              background:
                'radial-gradient(circle, rgba(168, 85, 247, 0.42) 0%, rgba(217, 70, 239, 0.22) 45%, rgba(0, 0, 0, 0) 74%)',
            }}
          />

          {!reducedMotion && (
            <div className="pointer-events-none absolute -inset-6">
              {ORBITAL_PARTICLES.map((p) => {
                const bg =
                  p.color === 'magenta' ? 'rgba(240, 171, 252, 0.9)' : 'rgba(192, 132, 252, 0.9)';
                return (
                  <span
                    key={p.id}
                    className="kuro-splash-ring-particle absolute rounded-full"
                    style={
                      {
                        left: p.left,
                        top: p.top,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: bg,
                        animationDelay: p.delay,
                        '--tx': p.tx,
                        '--ty': p.ty,
                      } as React.CSSProperties
                    }
                  />
                );
              })}
            </div>
          )}

          <div
            className={`relative h-full w-full ${
              reducedMotion ? 'kuro-splash-logo-reduced' : 'kuro-splash-logo-reveal'
            }`}
          >
            <img
              src={LOGO_SRC}
              alt="Flix4U"
              loading="eager"
              decoding="async"
              draggable={false}
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <div
          className={`mt-5 flex items-center gap-3.5 ${
            reducedMotion ? 'kuro-splash-tagline-reduced' : 'kuro-splash-tagline'
          }`}
        >
          <span
            className="h-px w-8 sm:w-12"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.9))',
            }}
          />
          <p className="font-display text-sm sm:text-base font-semibold tracking-[0.2em] text-white whitespace-nowrap">
            Watch <span className="text-purple-400">•</span> Stream{' '}
            <span className="text-fuchsia-400">•</span> Enjoy
          </p>
          <span
            className="h-px w-8 sm:w-12"
            style={{
              background: 'linear-gradient(90deg, rgba(217, 70, 239, 0.9), transparent)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

