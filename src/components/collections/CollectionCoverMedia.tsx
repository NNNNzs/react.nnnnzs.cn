'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import type { ResolvedCollectionVisual } from '@/lib/collection-visual';
import { ImageOptimizationType, optimizeImageUrl } from '@/lib/image';

interface CollectionCoverMediaProps {
  visual: ResolvedCollectionVisual;
  alt: string;
  priority?: boolean;
  sizes: string;
}

/**
 * 竖长合集封面媒体。
 * 配置视频时优先播放；减少动态或视频失败时使用同主题封面图，不依赖独立 poster。
 */
export default function CollectionCoverMedia({
  visual,
  alt,
  priority = false,
  sizes,
}: CollectionCoverMediaProps) {
  const shouldReduceMotion = useReducedMotion();
  const [failedVideoUrl, setFailedVideoUrl] = useState<string | null>(null);
  const shouldPlayVideo = Boolean(
    visual.coverVideoUrl
    && !shouldReduceMotion
    && failedVideoUrl !== visual.coverVideoUrl,
  );

  if (shouldPlayVideo && visual.coverVideoUrl) {
    return (
      <>
        <video
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          src={visual.coverVideoUrl}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          style={{ objectPosition: visual.objectPosition }}
          onError={() => setFailedVideoUrl(visual.coverVideoUrl || null)}
        />
        <span className="sr-only">{alt}</span>
      </>
    );
  }

  if (visual.coverImageUrl) {
    return (
      <Image
        src={optimizeImageUrl(visual.coverImageUrl, ImageOptimizationType.COLLECTION_COVER)}
        alt={alt}
        fill
        priority={priority}
        unoptimized
        className="object-cover"
        style={{ objectPosition: visual.objectPosition }}
        sizes={sizes}
      />
    );
  }

  return (
    <div
      aria-label={alt}
      className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/75"
      style={{ backgroundColor: visual.accentColor }}
    />
  );
}
