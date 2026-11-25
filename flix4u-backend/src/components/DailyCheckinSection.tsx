import React, { useState } from 'react';
import { CalendarCheck, Gift, Flame, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { CHECKIN_REWARDS, claimDailyCheckin, computeCheckinStatus } from '@/src/services/checkinService';
import { useAuth } from '@/src/context/AuthContext';

interface DailyCheckinSectionProps {
  userData: Record<string, unknown> | undefined;
  onCheckinSuccess: () => void;
}

export const DailyCheckinSection: React.FC<DailyCheckinSectionProps> = ({
  userData,
  onCheckinSuccess,
}) => {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const status = computeCheckinStatus(userData);
  const streak = status.checkinStreak || 0;
  const checkedInToday = status.checkedInToday;

  const handleClaim = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    const res = await claimDailyCheckin(user.uid, isAdmin);
    setMessage(res.message);
    setLoading(false);
    if (res.ok) {
      onCheckinSuccess();
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-purple-400" />
            Daily Check-in Rewards
          </h3>
          <p className="text-sm text-slate-400">
            Check in every day to maintain your streak and claim XP and coin bonuses!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-purple-950/60 border border-purple-500/30 px-4 py-2 rounded-2xl">
            <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
            <div>
              <div className="text-[10px] text-purple-300 font-medium uppercase tracking-wider">Streak</div>
              <div className="text-lg font-black text-white">{streak} Days</div>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="px-4 py-3 bg-purple-950/60 border border-purple-500/40 text-purple-200 text-sm rounded-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* 7-Day Rewards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {CHECKIN_REWARDS.map((reward) => {
          const isCompletedDay = streak >= reward.dayIndex || (streak === 0 && reward.dayIndex === 1 && checkedInToday);
          const isCurrentTargetDay = (streak % 7) + 1 === reward.dayIndex || (streak === 0 && reward.dayIndex === 1);

          return (
            <div
              key={reward.dayIndex}
              className={`relative rounded-2xl p-4 flex flex-col items-center text-center transition-all border ${
                isCompletedDay
                  ? 'bg-purple-950/40 border-purple-500/40 text-purple-200 shadow-md'
                  : isCurrentTargetDay
                  ? 'bg-slate-950 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-500'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="text-xs font-bold text-purple-400 mb-1">Day {reward.dayIndex}</div>
              <div className="w-10 h-10 rounded-full bg-purple-900/30 border border-purple-500/30 flex items-center justify-center my-2">
                {isCompletedDay ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Gift className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div className="text-xs font-bold text-white mb-0.5">+{reward.xp} XP</div>
              <div className="text-[10px] text-amber-300 font-medium">+{reward.coins} Coins</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Server-side verification active. Reset at midnight UTC.</span>
        </div>

        <button
          onClick={handleClaim}
          disabled={loading || (checkedInToday && !isAdmin)}
          className={`py-3 px-8 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${
            checkedInToday && !isAdmin
              ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
          }`}
        >
          {loading ? (
            'Claiming Reward...'
          ) : checkedInToday && !isAdmin ? (
            <>
              <CheckCircle2 className="w-5 h-5" /> Claimed Today
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" /> Claim Today's Check-in
            </>
          )}
        </button>
      </div>
    </div>
  );
};
