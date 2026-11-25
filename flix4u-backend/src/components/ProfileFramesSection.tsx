import React, { useState } from 'react';
import { Crown, Sparkles, Check, Lock } from 'lucide-react';
import { PROFILE_FRAMES, type ProfileFrameId } from '@/src/types/frames';
import { AvatarWithFrame } from '@/src/components/AvatarWithFrame';
import { useAuth } from '@/src/context/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from '@/src/lib/firebase';

interface ProfileFramesSectionProps {
  currentFrame: ProfileFrameId;
  userXp: number;
  userLevel: number;
  totalEpisodes: number;
  streakCurrent: number;
  watchedAnimeCount: number;
  onFrameChanged: (frameId: ProfileFrameId) => void;
}

export const ProfileFramesSection: React.FC<ProfileFramesSectionProps> = ({
  currentFrame,
  userXp,
  userLevel,
  totalEpisodes,
  streakCurrent,
  watchedAnimeCount,
  onFrameChanged,
}) => {
  const { user, isAdmin } = useAuth();
  const [equippingId, setEquippingId] = useState<ProfileFrameId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isFrameUnlocked = (frameId: ProfileFrameId): boolean => {
    if (isAdmin) return true;
    if (frameId === 'none') return true;
    if (frameId === 'purple_neon') return userLevel >= 3 || userXp >= 100;
    if (frameId === 'gold_vip') return userLevel >= 10 || userXp >= 1000;
    if (frameId === 'red_shadow') return streakCurrent >= 7;
    if (frameId === 'blue_galaxy') return watchedAnimeCount >= 5;
    if (frameId === 'demon_aura') return totalEpisodes >= 50;
    if (frameId === 'legendary_flame') return userLevel >= 25 || userXp >= 5000;
    if (frameId === 'anime_master') return totalEpisodes >= 250;
    if (frameId === 'royal_crown') return streakCurrent >= 30;
    return false;
  };

  const handleEquip = async (frameId: ProfileFrameId) => {
    if (!user || !db) return;
    const unlocked = isFrameUnlocked(frameId);
    if (!unlocked) {
      setNotice('Complete the unlock requirement for this frame first!');
      return;
    }

    setEquippingId(frameId);
    setNotice(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        equippedFrame: frameId,
        updatedAt: serverTimestamp(),
      });
      onFrameChanged(frameId);
      setNotice('Profile frame updated successfully!');
    } catch (err) {
      logFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setNotice('Failed to update profile frame.');
    } finally {
      setEquippingId(null);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" />
            Anime Profile Frames Collection
          </h3>
          <p className="text-sm text-slate-400">
            Equip premium anime glow rings and borders around your avatar. Admin has all frames unlocked!
          </p>
        </div>
        {isAdmin && (
          <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-full">
            Admin VIP Access
          </span>
        )}
      </div>

      {notice && (
        <div className="px-4 py-3 bg-purple-950/60 border border-purple-500/40 text-purple-200 text-sm rounded-2xl animate-fade-in">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PROFILE_FRAMES.map((frame) => {
          const unlocked = isFrameUnlocked(frame.id);
          const isEquipped = currentFrame === frame.id;

          return (
            <div
              key={frame.id}
              className={`relative bg-slate-950/70 border rounded-2xl p-5 flex flex-col items-center text-center transition-all duration-300 ${
                isEquipped
                  ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] bg-purple-950/20'
                  : unlocked
                  ? 'border-slate-800 hover:border-purple-500/50'
                  : 'border-slate-800/60 opacity-75'
              }`}
            >
              <div className="mb-4 pt-2">
                <AvatarWithFrame
                  src={user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={frame.name}
                  frameId={frame.id}
                  size="lg"
                />
              </div>

              <h4 className="font-bold text-white text-base mb-1">{frame.name}</h4>
              <p className="text-xs text-slate-400 mb-4 line-clamp-2">{frame.description}</p>

              <div className="mt-auto w-full space-y-2">
                {!unlocked && (
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/10 py-1.5 px-2 rounded-xl border border-amber-500/20">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{frame.unlockRequirement}</span>
                  </div>
                )}

                <button
                  onClick={() => handleEquip(frame.id)}
                  disabled={!unlocked || equippingId === frame.id}
                  className={`w-full py-2 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    isEquipped
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : unlocked
                      ? 'bg-slate-800 hover:bg-purple-600 text-white'
                      : 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isEquipped ? (
                    <>
                      <Check className="w-4 h-4" /> Equipped
                    </>
                  ) : unlocked ? (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-400" /> Equip Frame
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Locked
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
