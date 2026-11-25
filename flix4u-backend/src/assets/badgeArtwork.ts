import type { AchievementId } from '@/src/types/anime';

import animeExplorerArt from './images/badge_anime_explorer_1795437625632.jpg';
import animeLegendArt from './images/badge_anime_legend_1795437625522.jpg';
import animeMasterArt from './images/badge_anime_master_1795437625715.jpg';
import bingeWatcherArt from './images/badge_binge_watcher_1795437625172.jpg';
import firstWatchArt from './images/badge_first_watch_1795437625716.jpg';
import marathonLegendArt from './images/badge_marathon_legend_1795437625070.jpg';
import streakHundredArt from './images/badge_streak_hundred_1795437625685.jpg';
import streakSevenArt from './images/badge_streak_seven_1795437625710.jpg';
import streakThirtyArt from './images/badge_streak_thirty_1795437625221.jpg';
import streakThreeArt from './images/badge_streak_three_1795437625193.jpg';

/**
 * Client-only 3D artwork asset registry mapped by AchievementId.
 * Static ES imports ensure Vite bundles and inlines/hashes every badge graphic
 * cleanly for both Web builds and offline Capacitor Android APK packages.
 */
export const BADGE_ARTWORK_MAP: Partial<Record<AchievementId, string>> = {
  first_watch: firstWatchArt,
  streak_3: streakThreeArt,
  streak_7: streakSevenArt,
  streak_30: streakThirtyArt,
  streak_100: streakHundredArt,
  anime_explorer: animeExplorerArt,
  anime_master: animeMasterArt,
  anime_legend: animeLegendArt,
  binge_watcher: bingeWatcherArt,
  marathon_legend: marathonLegendArt,
};
