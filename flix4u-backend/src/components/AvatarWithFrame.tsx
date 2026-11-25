import React from 'react';
import type { ProfileFrameId } from '@/src/types/frames';
import { PROFILE_FRAMES } from '@/src/types/frames';

interface AvatarWithFrameProps {
  src: string;
  alt?: string;
  frameId?: ProfileFrameId | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  src,
  alt = 'Avatar',
  frameId = 'none',
  size = 'md',
  className = '',
}) => {
  const frame = PROFILE_FRAMES.find((f) => f.id === frameId);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }[size];

  const ringStyle = frame && frame.id !== 'none' ? frame.ringClass + ' ' + frame.glowClass : 'ring-1 ring-purple-500/30';

  return (
    <div className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${sizeClasses} ${className}`}>
      <div className={`absolute inset-0 rounded-full ${ringStyle} pointer-events-none transition-all duration-300`} />
      <img
        src={src || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
        alt={alt}
        className="w-full h-full object-cover rounded-full z-10 bg-slate-900"
      />
      {frame && frame.id !== 'none' && (
        <div className="absolute -bottom-1 -right-1 z-20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-300/30">
          {frame.badgeLabel}
        </div>
      )}
    </div>
  );
};
