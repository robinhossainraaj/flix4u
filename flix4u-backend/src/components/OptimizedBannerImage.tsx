import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getOptimizedUrls, isImageCached, markImageCached } from '@/src/services/imageCacheService';

interface OptimizedBannerImageProps {
  src: string;
  thumbnailUrl?: string;
  alt: string;
  className?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedBannerImage: React.FC<OptimizedBannerImageProps> = ({
  src,
  thumbnailUrl,
  alt,
  className = '',
  priority = false,
  onLoad,
  onError,
}) => {
  const { highRes, thumbnail } = getOptimizedUrls(src, thumbnailUrl);
  const showDistinctThumb = Boolean(thumbnail && thumbnail !== highRes);

  const alreadyCached = isImageCached(highRes);
  const [isHighResLoaded, setIsHighResLoaded] = useState<boolean>(alreadyCached);
  const [isThumbLoaded, setIsThumbLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(!highRes);

  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!highRes) {
      setHasError(true);
      setIsHighResLoaded(false);
      return;
    }

    setHasError(false);
    setIsThumbLoaded(false);

    if (isImageCached(highRes)) {
      setIsHighResLoaded(true);
      onLoadRef.current?.();
      return;
    }

    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0 && el.getAttribute('src') === highRes) {
      markImageCached(highRes);
      setIsHighResLoaded(true);
      onLoadRef.current?.();
      return;
    }

    setIsHighResLoaded(false);
  }, [highRes]);

  if (hasError) {
    return (
      <div className={`relative flex items-center justify-center bg-gradient-to-br from-[#121424] via-[#10121d] to-[#0a0c16] text-slate-500 overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-violet-950/20" />
        <div className="relative z-10 flex flex-col items-center gap-1.5 p-3 text-center">
          <ImageIcon className="h-6 w-6 text-violet-400/50" />
          <span className="text-[11px] font-medium text-slate-400 line-clamp-1">{alt || 'Anime Banner'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#0c0e18] ${className}`}>
      {!isHighResLoaded && (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-violet-950/20 via-[#111322] to-[#0b0d17]" />
      )}

      {!isHighResLoaded && showDistinctThumb && (
        <img
          src={thumbnail}
          alt=""
          aria-hidden="true"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setIsThumbLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover blur-xs scale-105 transition-opacity duration-200 ${
            isThumbLoaded ? 'opacity-80' : 'opacity-0'
          }`}
        />
      )}

      <img
        ref={imgRef}
        src={highRes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        referrerPolicy="no-referrer"
        onLoad={() => {
          markImageCached(highRes);
          setIsHighResLoaded(true);
          onLoadRef.current?.();
        }}
        onError={() => {
          setHasError(true);
          onErrorRef.current?.();
        }}
        className={`h-full w-full object-cover transform-gpu transition-opacity duration-200 ${
          isHighResLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
export default OptimizedBannerImage;
