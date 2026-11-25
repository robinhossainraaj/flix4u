export type ProfileFrameId =
  | 'none'
  | 'purple_neon'
  | 'gold_vip'
  | 'red_shadow'
  | 'blue_galaxy'
  | 'demon_aura'
  | 'legendary_flame'
  | 'anime_master'
  | 'royal_crown';

export interface ProfileFrameDefinition {
  id: ProfileFrameId;
  name: string;
  description: string;
  badgeLabel: string;
  colorHex: string;
  gradient: string;
  glowClass: string;
  ringClass: string;
  borderClass: string;
  unlockRequirement: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'purple' | 'special';
}

export const PROFILE_FRAMES: ProfileFrameDefinition[] = [
  {
    id: 'purple_neon',
    name: 'Purple Neon',
    description: 'Vibrant neon purple glowing border with Flix4U cyberpunk aesthetic.',
    badgeLabel: 'Neon Glow',
    colorHex: '#a855f7',
    gradient: 'from-purple-500 via-fuchsia-500 to-indigo-600',
    glowClass: 'shadow-[0_0_20px_rgba(168,85,247,0.6)]',
    ringClass: 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-purple-400/80',
    unlockRequirement: 'Reach Level 3 or earn 100 XP',
    tier: 'bronze',
  },
  {
    id: 'gold_vip',
    name: 'Gold VIP',
    description: 'Prestigious shimmering gold ring signaling elite streaming status.',
    badgeLabel: 'VIP Elite',
    colorHex: '#f59e0b',
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    glowClass: 'shadow-[0_0_22px_rgba(245,158,11,0.7)]',
    ringClass: 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-amber-400/90',
    unlockRequirement: 'Reach Level 10 or earn 1,000 XP',
    tier: 'gold',
  },
  {
    id: 'red_shadow',
    name: 'Red Shadow',
    description: 'Intense crimson red aura born from relentless streak dedication.',
    badgeLabel: 'Shadow Monarch',
    colorHex: '#ef4444',
    gradient: 'from-red-600 via-rose-500 to-orange-600',
    glowClass: 'shadow-[0_0_22px_rgba(239,68,68,0.7)]',
    ringClass: 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-red-500/90',
    unlockRequirement: 'Maintain a 7-day watch streak',
    tier: 'silver',
  },
  {
    id: 'blue_galaxy',
    name: 'Blue Galaxy',
    description: 'Cosmic deep blue starfield ring radiating infinite anime worlds.',
    badgeLabel: 'Cosmic Star',
    colorHex: '#3b82f6',
    gradient: 'from-blue-600 via-cyan-500 to-indigo-700',
    glowClass: 'shadow-[0_0_22px_rgba(59,130,246,0.7)]',
    ringClass: 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-blue-400/90',
    unlockRequirement: 'Explore & watch 5 different anime series',
    tier: 'purple',
  },
  {
    id: 'demon_aura',
    name: 'Demon Aura',
    description: 'Blazing dark violet and crimson demon flames of true endurance.',
    badgeLabel: 'Demon Slayer',
    colorHex: '#8b5cf6',
    gradient: 'from-violet-700 via-purple-600 to-rose-600',
    glowClass: 'shadow-[0_0_25px_rgba(139,92,246,0.8)]',
    ringClass: 'ring-2 ring-violet-500 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-violet-500/90',
    unlockRequirement: 'Complete 50 anime episodes',
    tier: 'gold',
  },
  {
    id: 'legendary_flame',
    name: 'Legendary Flame',
    description: 'Supersonic amber-orange blazing fire symbolizing ultimate passion.',
    badgeLabel: 'Super Flame',
    colorHex: '#f97316',
    gradient: 'from-orange-500 via-amber-500 to-red-600',
    glowClass: 'shadow-[0_0_28px_rgba(249,115,22,0.8)]',
    ringClass: 'ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-orange-400',
    unlockRequirement: 'Reach Level 25 or earn 5,000 XP',
    tier: 'diamond',
  },
  {
    id: 'anime_master',
    name: 'Anime Master',
    description: 'Royal amethyst and gold crown ring for true otaku connoisseurs.',
    badgeLabel: 'Master Otaku',
    colorHex: '#d946ef',
    gradient: 'from-fuchsia-600 via-pink-500 to-purple-700',
    glowClass: 'shadow-[0_0_28px_rgba(217,70,239,0.8)]',
    ringClass: 'ring-2 ring-fuchsia-400 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-fuchsia-400',
    unlockRequirement: 'Complete 250 anime episodes',
    tier: 'diamond',
  },
  {
    id: 'royal_crown',
    name: 'Royal Crown',
    description: 'Exclusive diamond-crusted sovereign crown for legendary 30-day streak champions.',
    badgeLabel: 'Sovereign',
    colorHex: '#06b6d4',
    gradient: 'from-cyan-400 via-teal-500 to-blue-600',
    glowClass: 'shadow-[0_0_30px_rgba(6,182,212,0.9)]',
    ringClass: 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950',
    borderClass: 'border-2 border-cyan-400',
    unlockRequirement: 'Maintain a 30-day continuous watch streak',
    tier: 'special',
  },
];
