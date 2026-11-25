import React, { useEffect, useRef, useState } from 'react';
import { ASSETS } from '@/src/config/env';

interface AnimeImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  variant?: 'poster' | 'banner' | 'avatar';
  className?: string;
  priority?: boolean;
}

export const AnimeImage: React.FC<AnimeImageProps> = ({
  src,
  fallbackSrc,
  alt,
  variant = 'poster',
  className = '',
  priority = false,
}) => {
  const assetFallback =
    variant === 'banner'
      ? ASSETS.heroFallback
      : variant === 'avatar'
        ? ASSETS.defaultAvatar
        : ASSETS.posterFallback;

  const cleanFallbackSrc =
    fallbackSrc && fallbackSrc.trim() && fallbackSrc.trim() !== (src || '').trim()
      ? fallbackSrc.trim()
      : null;

  const resolvedInitial = src && src.trim() ? src.trim() : cleanFallbackSrc || assetFallback;
  const [imgSrc, setImgSrc] = useState<string>(resolvedInitial);
  const [loaded, setLoaded] = useState(false);
  const [failedAll, setFailedAll] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const nextSrc = src && src.trim() ? src.trim() : cleanFallbackSrc || assetFallback;
    setImgSrc(nextSrc);
    setFailedAll(false);
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0 && el.getAttribute('src') === nextSrc) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src, cleanFallbackSrc, assetFallback]);

  if (failedAll) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#131526] via-[#1a1330] to-[#110f1b] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="text-xs font-semibold text-slate-300 line-clamp-2">{alt}</span>
      </div>
    );
  }

  const objectFitClass = className.includes('object-contain') ? 'object-contain' : 'object-cover';
  const objectPosClass = className.includes('object-top') ? 'object-top' : 'object-center';
  const eager = Boolean(priority);

  return (
    <div
      className={`relative isolate overflow-hidden bg-gradient-to-br from-[#111322] via-[#161329] to-[#0c0e18] ${className}`}
    >
      {!loaded && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-violet-950/20 via-[#141626] to-[#0d0f1a]"
        />
      )}
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (cleanFallbackSrc && imgSrc !== cleanFallbackSrc && imgSrc !== assetFallback) {
            setImgSrc(cleanFallbackSrc);
            setLoaded(false);
          } else if (imgSrc !== assetFallback) {
            setImgSrc(assetFallback);
            setLoaded(false);
          } else {
            setFailedAll(true);
          }
        }}
        className={`relative z-[1] h-full w-full ${objectFitClass} ${objectPosClass}`}
      />
    </div>
  );
};
