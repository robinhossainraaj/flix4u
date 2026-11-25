import type { ThemeConfig, ThemeId } from '@/src/types/anime';

export const THEMES: ThemeConfig[] = [
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    tagline: 'Signature Flix4U aesthetic',
    previewColor: '#8b5cf6',
    accentFrom: '#8b5cf6',
    accentTo: '#6d28d9',
    glowColor: 'rgba(139, 92, 246, 0.45)',
    bgDark: '#07080d',
    surfaceDark: '#10121c',
    description: 'Electric violet highlights over deep obsidian night sky.',
    contrastRatio: '14.8:1',
  },
  {
    id: 'deep-black',
    name: 'Deep Black',
    tagline: 'Minimalist stealth slate',
    previewColor: '#71717a',
    accentFrom: '#71717a',
    accentTo: '#3f3f46',
    glowColor: 'rgba(161, 161, 170, 0.35)',
    bgDark: '#07080b',
    surfaceDark: '#111319',
    description: 'Monochromatic carbon with crisp frosted titanium accents.',
    contrastRatio: '15.2:1',
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    tagline: 'Deep sapphire & neon cyan',
    previewColor: '#0ea5e9',
    accentFrom: '#38bdf8',
    accentTo: '#0284c7',
    glowColor: 'rgba(14, 165, 233, 0.48)',
    bgDark: '#030814',
    surfaceDark: '#081528',
    description: 'Abyssal navy depths glowing with vibrant electric cyan current.',
    contrastRatio: '14.5:1',
  },
  {
    id: 'crimson-red',
    name: 'Crimson Red',
    tagline: 'Blood ruby & dragon flame',
    previewColor: '#f43f5e',
    accentFrom: '#fb7185',
    accentTo: '#e11d48',
    glowColor: 'rgba(244, 63, 94, 0.48)',
    bgDark: '#0b0407',
    surfaceDark: '#1a0b12',
    description: 'Aggressive anime shonen ruby flares against scorched dark matte.',
    contrastRatio: '14.1:1',
  },
  {
    id: 'emerald-green',
    name: 'Emerald Green',
    tagline: 'Forest jade & bio-luminescence',
    previewColor: '#10b981',
    accentFrom: '#34d399',
    accentTo: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.46)',
    bgDark: '#030c08',
    surfaceDark: '#071c13',
    description: 'Lush cybernetic jade canopy with organic bioluminescent sheen.',
    contrastRatio: '14.6:1',
  },
  {
    id: 'rose-pink',
    name: 'Rose Pink',
    tagline: 'Cyber sakura & neon dusk',
    previewColor: '#ec4899',
    accentFrom: '#f472b6',
    accentTo: '#db2777',
    glowColor: 'rgba(236, 72, 153, 0.48)',
    bgDark: '#0a0409',
    surfaceDark: '#1a0b17',
    description: 'Vibrant neon cherry blossoms radiating over midnight streets.',
    contrastRatio: '14.2:1',
  },
  {
    id: 'amoled-black',
    name: 'AMOLED Black',
    tagline: 'True 0% black for OLED screens',
    previewColor: '#c084fc',
    accentFrom: '#c084fc',
    accentTo: '#9333ea',
    glowColor: 'rgba(192, 132, 252, 0.45)',
    bgDark: '#000000',
    surfaceDark: '#0a0a0a',
    description: 'Pure #000000 pixels for infinite contrast and maximum battery life.',
    contrastRatio: '21:1',
  },
];

export const THEME_STORAGE_KEY = 'flix4u_theme_v1';
export const DEFAULT_THEME_ID: ThemeId = 'midnight-purple';

export function isValidThemeId(val: unknown): val is ThemeId {
  return (
    typeof val === 'string' &&
    THEMES.some((t) => t.id === val)
  );
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidThemeId(raw)) return raw;
  } catch {
    // ignore storage access errors
  }
  return DEFAULT_THEME_ID;
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const safeId: ThemeId = isValidThemeId(themeId) ? themeId : DEFAULT_THEME_ID;
  root.setAttribute('data-theme', safeId);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, safeId);
  } catch {
    // ignore storage errors
  }
}

export function getThemeConfig(themeId?: string): ThemeConfig {
  const match = THEMES.find((t) => t.id === themeId);
  return match || THEMES[0];
}

// Auto-run on import to ensure early theme hydration
if (typeof window !== 'undefined') {
  const initial = getStoredTheme();
  applyTheme(initial);
}
