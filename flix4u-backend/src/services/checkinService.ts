import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from '@/src/lib/firebase';
import { getTodayDateKey, getYesterdayDateKey } from '@/src/services/achievementService';

export interface CheckinDayReward {
  dayIndex: number; // 1 to 7
  xp: number;
  coins: number;
  title: string;
}

export const CHECKIN_REWARDS: CheckinDayReward[] = [
  { dayIndex: 1, xp: 50, coins: 10, title: 'Day 1: Welcome Check-in' },
  { dayIndex: 2, xp: 75, coins: 15, title: 'Day 2: Streamer Spark' },
  { dayIndex: 3, xp: 100, coins: 20, title: 'Day 3: Flame Ignited' },
  { dayIndex: 4, xp: 125, coins: 25, title: 'Day 4: Otaku Focus' },
  { dayIndex: 5, xp: 150, coins: 30, title: 'Day 5: Marathon Power' },
  { dayIndex: 6, xp: 200, coins: 40, title: 'Day 6: Legend Rising' },
  { dayIndex: 7, xp: 350, coins: 75, title: 'Day 7: 7-Day Blaze Crown' },
];

export interface ClaimCheckinResult {
  ok: boolean;
  xpAwarded: number;
  coinsAwarded: number;
  newStreak: number;
  message: string;
}

export async function claimDailyCheckin(
  uid: string,
  isAdmin: boolean
): Promise<ClaimCheckinResult> {
  if (!db) {
    return { ok: false, xpAwarded: 0, coinsAwarded: 0, newStreak: 0, message: 'Database not available.' };
  }
  const userRef = doc(db, 'users', uid);
  const today = getTodayDateKey();
  const yesterday = getYesterdayDateKey();

  try {
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    const lastDate = typeof data.lastCheckinDate === 'string' ? data.lastCheckinDate : '';

    if (!isAdmin && lastDate === today) {
      return {
        ok: false,
        xpAwarded: 0,
        coinsAwarded: 0,
        newStreak: typeof data.checkinStreak === 'number' ? data.checkinStreak : 1,
        message: 'You have already claimed your daily check-in reward today! Come back tomorrow.',
      };
    }

    let currentStreak = typeof data.checkinStreak === 'number' ? data.checkinStreak : 0;
    if (isAdmin) {
      currentStreak = Math.max(currentStreak + 1, 7);
    } else if (lastDate === yesterday) {
      currentStreak = (currentStreak % 7) + 1;
    } else {
      currentStreak = 1;
    }

    const rewardIndex = ((currentStreak - 1) % 7);
    const reward = CHECKIN_REWARDS[rewardIndex];

    const currentXp = typeof data.xp === 'number' ? data.xp : 0;
    const currentCoins = typeof data.coins === 'number' ? data.coins : 0;
    const currentTotalCheckins = typeof data.totalCheckins === 'number' ? data.totalCheckins : 0;

    const nextXp = currentXp + reward.xp;
    const nextCoins = currentCoins + reward.coins;

    await updateDoc(userRef, {
      lastCheckinDate: today,
      checkinStreak: currentStreak,
      totalCheckins: currentTotalCheckins + 1,
      xp: nextXp,
      coins: nextCoins,
      updatedAt: serverTimestamp(),
    });

    return {
      ok: true,
      xpAwarded: reward.xp,
      coinsAwarded: reward.coins,
      newStreak: currentStreak,
      message: `Successfully claimed ${reward.title}! +${reward.xp} XP & +${reward.coins} Coins added.`,
    };
  } catch (err) {
    logFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    return { ok: false, xpAwarded: 0, coinsAwarded: 0, newStreak: 0, message: 'Failed to claim check-in reward. Please try again.' };
  }
}

export interface CheckinState {
  lastCheckinDate?: string;
  checkinStreak?: number;
  totalCheckins?: number;
  checkedInToday?: boolean;
}

export function computeCheckinStatus(userData: Record<string, unknown> | undefined): CheckinState {
  if (!userData) {
    return { checkinStreak: 0, totalCheckins: 0, checkedInToday: false };
  }
  const today = getTodayDateKey();
  const lastDate = typeof userData.lastCheckinDate === 'string' ? userData.lastCheckinDate : '';
  const streak = typeof userData.checkinStreak === 'number' ? userData.checkinStreak : 0;
  const total = typeof userData.totalCheckins === 'number' ? userData.totalCheckins : 0;

  const checkedInToday = lastDate === today;
  return {
    lastCheckinDate: lastDate,
    checkinStreak: streak,
    totalCheckins: total,
    checkedInToday,
  };
}
