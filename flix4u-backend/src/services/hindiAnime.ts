import type { AnimeSummary } from '@/src/types/anime';

// Verified Hindi Dubbed Anime IDs on AniList / MyAnimeList (Doraemon, Shinchan, Pokemon, DBZ, Naruto, etc.)
const VERIFIED_HINDI_DUBBED_IDS = new Set<number>([
  2471, // Doraemon
  966,  // Crayon Shin-chan
  527,  // Pokémon
  813,  // Dragon Ball Z
  2235, // Dragon Ball
  20,   // Naruto
  1735, // Naruto: Shippuuden
  21,   // One Piece
  16498, // Attack on Titan (Shingeki no Kyojin)
  38000, // Demon Slayer (Kimetsu no Yaiba)
  31964, // My Hero Academia
  101922, // Jujutsu Kaisen
  1535, // Death Note
  11061, // Hunter x Hunter (2011)
  30276, // One-Punch Man
]);

const HINDI_DUBBED_KEYWORDS = [
  'doraemon',
  'shin chan',
  'shinchan',
  'pokémon',
  'pokemon',
  'dragon ball z',
  'dragon ball',
  'naruto',
  'one piece',
  'attack on titan',
  'demon slayer',
  'jujutsu kaisen',
  'death note',
  'my hero academia',
  'hunter x hunter',
  'one-punch man',
];

export const VERIFIED_HINDI_DUBBED_ID_LIST = Array.from(VERIFIED_HINDI_DUBBED_IDS);

export function isHindiDubbedAnime(anime: AnimeSummary | { id: number; title?: { english?: string | null; romaji?: string | null } }): boolean {
  if (VERIFIED_HINDI_DUBBED_IDS.has(anime.id)) return true;
  const titleStr = `${anime.title?.english || ''} ${anime.title?.romaji || ''}`.toLowerCase();
  return HINDI_DUBBED_KEYWORDS.some((kw) => titleStr.includes(kw));
}
