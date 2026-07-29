'use client';

import Image from 'next/image';
import type { CollectionVisualConfig } from '@/lib/collection-visual';
import { resolveCollectionVisual } from '@/lib/collection-visual';
import { useStyleVariant } from '@/lib/site-style/useStyleVariant';
import { ImageOptimizationType, optimizeImageUrl } from '@/lib/image';

interface CollectionAmbientMediaProps {
  cover?: string | null;
  background?: string | null;
  color?: string | null;
  extends_json: CollectionVisualConfig | null;
}

/** 合集详情页的静态空间背景；动态视频只在竖长封面槽位播放。 */
export default function CollectionAmbientMedia(props: CollectionAmbientMediaProps) {
  const variant = useStyleVariant();
  const visual = resolveCollectionVisual(props, variant);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {visual.backgroundImageUrl ? (
        <Image
          src={optimizeImageUrl(visual.backgroundImageUrl, ImageOptimizationType.COLLECTION_BACKGROUND)}
          alt=""
          fill
          priority
          unoptimized
          className="object-cover opacity-55 saturate-[0.85] dark:opacity-50 dark:saturate-[0.8]"
          style={{ objectPosition: visual.objectPosition }}
          sizes="100vw"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(239,242,240,0.88)_0%,rgba(239,242,240,0.76)_48%,rgba(239,242,240,0.5)_100%)] dark:bg-[linear-gradient(90deg,rgba(3,8,15,0.86)_0%,rgba(3,8,15,0.74)_52%,rgba(3,8,15,0.56)_100%)]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(40,56,64,0.18)_1px,transparent_1px)] [background-size:100%_36px] dark:opacity-[0.18]" />
    </div>
  );
}
