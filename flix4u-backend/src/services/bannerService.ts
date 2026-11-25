import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { getOptimizedUrls } from '@/src/services/imageCacheService';

export interface ProfileBanner {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  thumbnailUrl?: string;
  enabled: boolean;
  isLocked: boolean;
  isCustom?: boolean;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProfileBannerInput {
  title?: string;
  category: string;
  imageUrl: string;
  thumbnailUrl?: string;
  enabled?: boolean;
  isLocked?: boolean;
}

export interface CustomizationSettings {
  id: 'global';
  globalBannersUnlocked: boolean;
  globalAvatarsUnlocked: boolean;
  lockedBannerIds: string[];
  lockedAvatarIds: string[];
  updatedBy?: string;
  updatedAt?: number;
}

export const BANNER_CATEGORIES = [
  'All',
  'Naruto',
  'One Piece',
  'Demon Slayer',
  'Jujutsu Kaisen',
  'Solo Leveling',
  'Attack on Titan',
  'Dragon Ball',
  'Bleach',
  'Black Clover',
  'Chainsaw Man',
  'Blue Lock',
  'Tokyo Revengers',
  'Anime Aesthetic',
  'Dark Anime',
  'Purple Neon',
] as const;

export type BannerCategory = (typeof BANNER_CATEGORIES)[number];

export function normalizeBannerCategory(cat: string): BannerCategory {
  if (!cat) return 'Anime Aesthetic';
  const clean = cat.trim();
  if (clean === 'All') return 'All';
  if (clean.includes('Naruto')) return 'Naruto';
  if (clean.includes('One Piece')) return 'One Piece';
  if (clean.includes('Demon Slayer')) return 'Demon Slayer';
  if (clean.includes('Jujutsu')) return 'Jujutsu Kaisen';
  if (clean.includes('Solo Leveling')) return 'Solo Leveling';
  if (clean.includes('Attack on Titan') || clean.includes('AOT')) return 'Attack on Titan';
  if (clean.includes('Dragon Ball')) return 'Dragon Ball';
  if (clean.includes('Bleach')) return 'Bleach';
  if (clean.includes('Black Clover')) return 'Black Clover';
  if (clean.includes('Chainsaw')) return 'Chainsaw Man';
  if (clean.includes('Blue Lock')) return 'Blue Lock';
  if (clean.includes('Tokyo Revengers')) return 'Tokyo Revengers';
  if (clean.includes('Purple') || clean.includes('Neon') || clean.includes('Cyberpunk')) return 'Purple Neon';
  if (clean.includes('Dark')) return 'Dark Anime';
  if (
    clean.includes('Anime') ||
    clean.includes('Aesthetic') ||
    clean.includes('Nature') ||
    clean.includes('Minimalist') ||
    clean.includes('Gaming')
  ) {
    return 'Anime Aesthetic';
  }
  return (BANNER_CATEGORIES as readonly string[]).includes(clean)
    ? (clean as BannerCategory)
    : 'Anime Aesthetic';
}

export const DEFAULT_CUSTOMIZATION_SETTINGS: CustomizationSettings = {
  id: 'global',
  globalBannersUnlocked: true,
  globalAvatarsUnlocked: true,
  lockedBannerIds: [],
  lockedAvatarIds: [],
};

// Verified high-definition curated wide landscape banners across all 15 categories with thumbnails
export const CURATED_PROFILE_BANNERS: ProfileBanner[] = [
  // 1. Naruto
  {
    id: 'curated_naruto_classic',
    title: 'Naruto Uzumaki Konoha Sunset',
    category: 'Naruto',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20/banner_20.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20/banner_20.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_naruto_shippuden',
    title: 'Naruto Shippuden Shinobi World',
    category: 'Naruto',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1735.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1735.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_naruto_valley',
    title: 'Valley of the End Clash',
    category: 'Naruto',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_naruto_uchiha',
    title: 'Uchiha Clan Moonlit Night',
    category: 'Naruto',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 2. One Piece
  {
    id: 'curated_op_grandline',
    title: 'One Piece Grand Line Odyssey',
    category: 'One Piece',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VvZkCtcz.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VvZkCtcz.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_op_wano',
    title: 'Wano Country Sakura Harbor',
    category: 'One Piece',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_op_sunny',
    title: 'Thousand Sunny Open Oceans',
    category: 'One Piece',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 3. Demon Slayer
  {
    id: 'curated_ds_kamado',
    title: 'Demon Slayer Tanjiro & Nezuko',
    category: 'Demon Slayer',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-Y76W178X2n8J.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-Y76W178X2n8J.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_ds_mugen',
    title: 'Mugen Train Flame Pillar',
    category: 'Demon Slayer',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/112151-c1qS6FvFk3Qv.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/112151-c1qS6FvFk3Qv.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_ds_swordsmith',
    title: 'Swordsmith Village Misty Dawn',
    category: 'Demon Slayer',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/145139-44Fp634b0XzQ.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/145139-44Fp634b0XzQ.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_ds_wisteria',
    title: 'Wisteria Flower Sacred Mountain',
    category: 'Demon Slayer',
    imageUrl: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 4. Jujutsu Kaisen
  {
    id: 'curated_jjk_curse',
    title: 'Jujutsu Kaisen Tokyo Sorcery',
    category: 'Jujutsu Kaisen',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQGoKfHzrEtu.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQGoKfHzrEtu.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_jjk_shibuya',
    title: 'Shibuya Incident Arc Night',
    category: 'Jujutsu Kaisen',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/145064-7W8vS7U4Y1yv.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/145064-7W8vS7U4Y1yv.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_jjk_domain',
    title: 'Domain Expansion Infinite Void',
    category: 'Jujutsu Kaisen',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 5. Solo Leveling
  {
    id: 'curated_sl_monarch',
    title: 'Solo Leveling Shadow Monarch',
    category: 'Solo Leveling',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-3w6yUaV4wO1t.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-3w6yUaV4wO1t.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_sl_arise',
    title: 'Shadow Army Arise Violet Horizon',
    category: 'Solo Leveling',
    imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_sl_gate',
    title: 'D-Rank Dungeon Blue Gates',
    category: 'Solo Leveling',
    imageUrl: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 6. Attack on Titan
  {
    id: 'curated_aot_colossal',
    title: 'Attack on Titan Colossal Wall',
    category: 'Attack on Titan',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jp4699gW4v2.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jp4699gW4v2.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_aot_wings',
    title: 'Scouting Legion Freedom Wings',
    category: 'Attack on Titan',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20958-zpt1jR28jYqO.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20958-zpt1jR28jYqO.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_aot_rumbling',
    title: 'Shingeki Final Season Sunset',
    category: 'Attack on Titan',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/110277-mwUqL2m42K6t.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/110277-mwUqL2m42K6t.jpg',
    enabled: true,
    isLocked: false,
  },

  // 7. Dragon Ball
  {
    id: 'curated_db_super',
    title: 'Dragon Ball Super Universe Survival',
    category: 'Dragon Ball',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21175-hZp5XyK97u23.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21175-hZp5XyK97u23.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_db_aura',
    title: 'Ultra Instinct Aura Horizon',
    category: 'Dragon Ball',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_db_namek',
    title: 'Namek Planet Emerald Skies',
    category: 'Dragon Ball',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 8. Bleach
  {
    id: 'curated_bleach_tybw',
    title: 'Bleach Thousand-Year Blood War',
    category: 'Bleach',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/114446-2jWb8x92WjT1.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/114446-2jWb8x92WjT1.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_bleach_seireitei',
    title: 'Soul Society Seireitei Horizon',
    category: 'Bleach',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/269-eXf9Q0B4nE9V.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/269-eXf9Q0B4nE9V.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_bleach_bankai',
    title: 'Bankai Midnight Moon',
    category: 'Bleach',
    imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 9. Black Clover
  {
    id: 'curated_bc_kingdom',
    title: 'Black Clover Clover Kingdom Knights',
    category: 'Black Clover',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/97940-fL2Jc7QyXq4r.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/97940-fL2Jc7QyXq4r.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_bc_sword',
    title: 'Anti-Magic Demon Slayer Blade',
    category: 'Black Clover',
    imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 10. Chainsaw Man
  {
    id: 'curated_csm_tokyo',
    title: 'Chainsaw Man Tokyo Horizon',
    category: 'Chainsaw Man',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/127230-NuZgO4vGfC42.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/127230-NuZgO4vGfC42.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_csm_night',
    title: 'Devil Hunter Public Safety Night',
    category: 'Chainsaw Man',
    imageUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_csm_dusk',
    title: 'Hayakawa Balcony Cigarette Dusk',
    category: 'Chainsaw Man',
    imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 11. Blue Lock
  {
    id: 'curated_bl_facility',
    title: 'Blue Lock Egoist Training Facility',
    category: 'Blue Lock',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/137822-tH4w93F8p0xY.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/137822-tH4w93F8p0xY.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_bl_neon',
    title: 'Neon Pitch Striker Zone',
    category: 'Blue Lock',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_bl_ego',
    title: 'Ego Blue Aura Arena',
    category: 'Blue Lock',
    imageUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 12. Tokyo Revengers
  {
    id: 'curated_tr_manji',
    title: 'Tokyo Revengers Manji Gang Night',
    category: 'Tokyo Revengers',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/120174-88Zt5mO8K89y.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/120174-88Zt5mO8K89y.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_tr_shibuya',
    title: 'Shibuya Crossing Streetlight Drift',
    category: 'Tokyo Revengers',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_tr_cruise',
    title: 'Tokyo Midnight Motorcycle Cruising',
    category: 'Tokyo Revengers',
    imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 13. Anime Aesthetic
  {
    id: 'curated_anime_yourname',
    title: 'Your Name Twilight Meteor Sky',
    category: 'Anime Aesthetic',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21519-1ayhpG1J4L5F.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21519-1ayhpG1J4L5F.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_anime_weathering',
    title: 'Weathering With You Cloud Temple',
    category: 'Anime Aesthetic',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/106286-9a25Q1vT1E4X.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/106286-9a25Q1vT1E4X.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_nature_pagoda',
    title: 'Mount Fuji Cherry Blossom Pagoda',
    category: 'Anime Aesthetic',
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_nature_starry',
    title: 'Starry Sky Mountain Reflections',
    category: 'Anime Aesthetic',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_anime_cowboy',
    title: 'Cowboy Bebop Swordfish Red',
    category: 'Anime Aesthetic',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1-OqWD0o317J.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1-OqWD0o317J.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_anime_hxh',
    title: 'Hunter x Hunter Chimera Horizon',
    category: 'Anime Aesthetic',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/11061-9c60e5b79685.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/11061-9c60e5b79685.jpg',
    enabled: true,
    isLocked: false,
  },

  // 14. Dark Anime
  {
    id: 'curated_dark_silhouette',
    title: 'Obsidian Eclipse Silhouette',
    category: 'Dark Anime',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_dark_mist',
    title: 'Dark Forest Velvet Mist',
    category: 'Dark Anime',
    imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_dark_berserk',
    title: 'Berserk Eclipse Red Horizon',
    category: 'Dark Anime',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_dark_cathedral',
    title: 'Death Note Rain Drenched Cathedral',
    category: 'Dark Anime',
    imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },

  // 15. Purple Neon
  {
    id: 'curated_purple_horizon',
    title: 'Flix4U Cyber Neon Horizon',
    category: 'Purple Neon',
    imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_purple_synth',
    title: 'Tokyo Midnight Purple Glow',
    category: 'Purple Neon',
    imageUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_cyber_edgerunners',
    title: 'Cyberpunk Edgerunners Skyline',
    category: 'Purple Neon',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/120377-167jFzR8x0Hq.jpg',
    thumbnailUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/120377-167jFzR8x0Hq.jpg',
    enabled: true,
    isLocked: false,
  },
  {
    id: 'curated_purple_grid',
    title: 'Synthwave Violet Grid Sunset',
    category: 'Purple Neon',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=480&q=65',
    enabled: true,
    isLocked: false,
  },
];

function generateSafeBannerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pb_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `pb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function subscribeCustomizationSettings(
  onUpdate: (settings: CustomizationSettings) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) {
    onUpdate(DEFAULT_CUSTOMIZATION_SETTINGS);
    return () => {};
  }

  const docRef = doc(db, 'customization_settings', 'global');
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_CUSTOMIZATION_SETTINGS);
        return;
      }
      const data = snap.data();
      onUpdate({
        id: 'global',
        globalBannersUnlocked:
          typeof data.globalBannersUnlocked === 'boolean' ? data.globalBannersUnlocked : true,
        globalAvatarsUnlocked:
          typeof data.globalAvatarsUnlocked === 'boolean' ? data.globalAvatarsUnlocked : true,
        lockedBannerIds: Array.isArray(data.lockedBannerIds) ? data.lockedBannerIds : [],
        lockedAvatarIds: Array.isArray(data.lockedAvatarIds) ? data.lockedAvatarIds : [],
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
        updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
      });
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'customization_settings/global');
    }
  );
}

export function subscribeProfileBanners(
  onUpdate: (banners: ProfileBanner[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) {
    onUpdate(CURATED_PROFILE_BANNERS);
    return () => {};
  }

  const colRef = collection(db, 'profile_banners');
  return onSnapshot(
    colRef,
    (snap) => {
      const customBanners: ProfileBanner[] = snap.docs.map((d) => {
        const data = d.data();
        const rawCat = String(data.category || 'Anime Aesthetic').slice(0, 60);
        const { highRes, thumbnail } = getOptimizedUrls(
          String(data.imageUrl || ''),
          typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined
        );

        return {
          id: d.id,
          title: String(data.title || '').slice(0, 120),
          category: normalizeBannerCategory(rawCat),
          imageUrl: highRes,
          thumbnailUrl: thumbnail,
          enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
          isLocked: typeof data.isLocked === 'boolean' ? data.isLocked : false,
          isCustom: true,
          createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
        };
      });

      // Merge custom banners with curated banners (custom ones first so admin additions shine)
      const merged = [...customBanners, ...CURATED_PROFILE_BANNERS];
      onUpdate(merged);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'profile_banners');
    }
  );
}

function validatePersistedBannerImageUrl(rawUrl: string): string {
  const imageUrl = rawUrl.trim();
  if (!imageUrl) {
    throw new Error('Banner image is required.');
  }
  if (/^(blob:|data:|file:|content:)/i.test(imageUrl)) {
    throw new Error('Banner image must be uploaded to the server or use a valid web URL before publishing.');
  }
  if (!imageUrl.startsWith('/api/banners/image/')) {
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      throw new Error('Please enter a valid image URL starting with https:// or http://.');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Image URL must use https:// or http://.');
    }
  }
  if (imageUrl.length > 500) {
    throw new Error('Image URL must not exceed 500 characters.');
  }
  return imageUrl;
}

export async function addCustomProfileBanner(
  adminUid: string,
  input: ProfileBannerInput
): Promise<string> {
  if (!db) throw new Error('Firestore is not configured.');
  const category = normalizeBannerCategory(input.category);
  const title = (input.title || '').trim().slice(0, 120) || `${category} Banner`;
  const imageUrl = validatePersistedBannerImageUrl(input.imageUrl);

  const bannerId = generateSafeBannerId();
  const path = `profile_banners/${bannerId}`;
  const payload: Record<string, unknown> = {
    id: bannerId,
    title,
    category,
    imageUrl,
    enabled: input.enabled !== false,
    isLocked: Boolean(input.isLocked),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'profile_banners', bannerId), payload);
    return bannerId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export async function updateProfileBanner(
  bannerId: string,
  patch: Partial<ProfileBannerInput>
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const path = `profile_banners/${bannerId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof patch.category === 'string' && patch.category.trim()) {
    const normalizedCat = normalizeBannerCategory(patch.category);
    payload.category = normalizedCat;
    if (typeof patch.title !== 'string' || !patch.title.trim()) {
      payload.title = `${normalizedCat} Banner`;
    }
  }
  if (typeof patch.title === 'string' && patch.title.trim()) {
    payload.title = patch.title.trim().slice(0, 120);
  }
  if (typeof patch.imageUrl === 'string' && patch.imageUrl.trim()) {
    payload.imageUrl = validatePersistedBannerImageUrl(patch.imageUrl);
  }
  if (typeof patch.enabled === 'boolean') {
    payload.enabled = patch.enabled;
  }
  if (typeof patch.isLocked === 'boolean') {
    payload.isLocked = patch.isLocked;
  }

  try {
    await updateDoc(doc(db, 'profile_banners', bannerId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function deleteProfileBanner(bannerId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const path = `profile_banners/${bannerId}`;
  try {
    await deleteDoc(doc(db, 'profile_banners', bannerId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
}

export async function saveCustomizationSettings(
  adminUid: string,
  patch: Partial<CustomizationSettings>
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const path = 'customization_settings/global';

  try {
    const docRef = doc(db, 'customization_settings', 'global');
    const existingSnap = await getDoc(docRef);

    const base = existingSnap.exists()
      ? (existingSnap.data() as CustomizationSettings)
      : DEFAULT_CUSTOMIZATION_SETTINGS;

    const payload = {
      id: 'global',
      globalBannersUnlocked:
        patch.globalBannersUnlocked !== undefined
          ? patch.globalBannersUnlocked
          : base.globalBannersUnlocked,
      globalAvatarsUnlocked:
        patch.globalAvatarsUnlocked !== undefined
          ? patch.globalAvatarsUnlocked
          : base.globalAvatarsUnlocked,
      lockedBannerIds: patch.lockedBannerIds ?? base.lockedBannerIds ?? [],
      lockedAvatarIds: patch.lockedAvatarIds ?? base.lockedAvatarIds ?? [],
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export async function setGlobalBannersUnlocked(
  adminUid: string,
  unlocked: boolean
): Promise<void> {
  return saveCustomizationSettings(adminUid, { globalBannersUnlocked: unlocked });
}

export async function setGlobalAvatarsUnlocked(
  adminUid: string,
  unlocked: boolean
): Promise<void> {
  return saveCustomizationSettings(adminUid, { globalAvatarsUnlocked: unlocked });
}

export async function toggleBannerLock(
  adminUid: string,
  banner: ProfileBanner,
  isLocked: boolean,
  currentSettings: CustomizationSettings
): Promise<void> {
  if (banner.isCustom) {
    await updateProfileBanner(banner.id, { isLocked });
    return;
  }

  const nextLocked = new Set(currentSettings.lockedBannerIds || []);
  if (isLocked) {
    nextLocked.add(banner.id);
  } else {
    nextLocked.delete(banner.id);
  }
  await saveCustomizationSettings(adminUid, {
    lockedBannerIds: Array.from(nextLocked),
  });
}

export async function toggleAvatarLock(
  adminUid: string,
  avatarId: string | number,
  isLocked: boolean,
  currentSettings: CustomizationSettings
): Promise<void> {
  const idStr = String(avatarId);
  const nextLocked = new Set(currentSettings.lockedAvatarIds || []);
  if (isLocked) {
    nextLocked.add(idStr);
  } else {
    nextLocked.delete(idStr);
  }
  await saveCustomizationSettings(adminUid, {
    lockedAvatarIds: Array.from(nextLocked),
  });
}

export function isBannerUnlocked(
  banner: ProfileBanner,
  settings: CustomizationSettings | null,
  isAdminUser: boolean
): boolean {
  if (isAdminUser) return true;
  if (!settings) return true;
  if (settings.globalBannersUnlocked === false) return false;
  if ((settings.lockedBannerIds || []).includes(banner.id)) return false;
  return !banner.isLocked;
}

export function isAvatarUnlocked(
  avatarId: string | number,
  settings: CustomizationSettings | null,
  isAdminUser: boolean
): boolean {
  if (isAdminUser) return true;
  if (!settings) return true;
  if (settings.globalAvatarsUnlocked === false) return false;
  return !(settings.lockedAvatarIds || []).includes(String(avatarId));
}
