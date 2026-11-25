import React, { useState } from 'react';
import { Check, Contrast, Palette, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import {
  applyTheme,
  DEFAULT_THEME_ID,
  getStoredTheme,
  THEMES,
} from '@/src/services/themeService';
import type { ThemeId } from '@/src/types/anime';

interface ThemeSelectorProps {
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className = '' }) => {
  const { preferences, updatePreferences } = useAuth();
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => {
    return preferences.theme || getStoredTheme();
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSelectTheme = async (themeId: ThemeId) => {
    setActiveTheme(themeId);
    applyTheme(themeId);
    await updatePreferences({ theme: themeId });
    const target = THEMES.find((t) => t.id === themeId);
    setToastMessage(`Theme updated to ${target?.name || themeId}`);
    window.setTimeout(() => setToastMessage(null), 2400);
  };

  const handleResetDefault = async () => {
    await handleSelectTheme(DEFAULT_THEME_ID);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-400" />
            <span>Custom Themes & Accent Colors</span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Personalize backgrounds, buttons, bottom navigation and luminous accent glows
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefault}
          className="kuro-btn-glass inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <RotateCcw className="h-3 w-3" />
          <span>System Default</span>
        </button>
      </div>

      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition-all">
          <Check className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {THEMES.map((theme) => {
          const isSelected = activeTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleSelectTheme(theme.id)}
              aria-pressed={isSelected}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                isSelected
                  ? 'border-2 border-white/40 shadow-xl'
                  : 'border border-white/[0.08] hover:border-white/20 hover:scale-[1.01]'
              }`}
              style={{
                backgroundColor: theme.bgDark,
                boxShadow: isSelected ? `0 12px 30px -8px ${theme.glowColor}` : undefined,
              }}
            >
              {/* Top Row: Color Preview Swatches & Checkmark */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-full shadow-md"
                    style={{
                      background: `linear-gradient(135deg, ${theme.accentFrom}, ${theme.accentTo})`,
                      boxShadow: `0 0 10px ${theme.glowColor}`,
                    }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: theme.surfaceDark }}
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-white/10"
                    style={{ backgroundColor: theme.bgDark }}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                    <Contrast className="h-2.5 w-2.5" />
                    <span>{theme.contrastRatio}</span>
                  </span>

                  {isSelected && (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: theme.previewColor }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div className="mt-3">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white group-hover:text-slate-100">
                    {theme.name}
                  </h4>
                  {theme.id === DEFAULT_THEME_ID && (
                    <span className="rounded bg-violet-600/30 border border-violet-400/30 px-1.5 py-0.2 text-[9px] font-semibold text-violet-200">
                      Default
                    </span>
                  )}
                  {theme.id === 'amoled-black' && (
                    <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 text-[9px] font-semibold text-purple-300">
                      OLED
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                  {theme.tagline}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                  {theme.description}
                </p>
              </div>

              {/* Bottom Mini Mockup Preview */}
              <div
                className="mt-3 flex items-center justify-between rounded-xl p-2 border border-white/[0.06]"
                style={{ backgroundColor: theme.surfaceDark }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: theme.previewColor }}
                  />
                  <span className="text-[10px] text-slate-300 font-medium">Nav Orb</span>
                </div>
                <div
                  className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accentFrom}, ${theme.accentTo})`,
                  }}
                >
                  Active
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
