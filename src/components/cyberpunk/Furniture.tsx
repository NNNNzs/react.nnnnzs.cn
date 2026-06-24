'use client';

import type { HomepageSceneVariant } from './theme';
import type { BookshelfCollection, DeployRecord, ScreenTextureData } from './furniture/types';
import WorkstationZone from './furniture/WorkstationZone';
import StorageWallZone from './furniture/StorageWallZone';
import LivingCoreZone from './furniture/LivingCoreZone';
import SleepZone from './furniture/SleepZone';
import WardrobeZone from './furniture/WardrobeZone';
import CeilingAndFloorDetails from './furniture/CeilingAndFloorDetails';
import NeonSign from './furniture/NeonSign';
import type { Post } from '@/types';

export default function Furniture({
  variant = 'night',
  posts = [],
  collections,
  screenData,
  deployHistory,
}: {
  variant?: HomepageSceneVariant;
  posts?: Post[];
  collections?: BookshelfCollection[];
  screenData?: [ScreenTextureData, ScreenTextureData, ScreenTextureData];
  deployHistory?: DeployRecord[];
}) {
  return (
    <group>
      {/* 家具层只做装配，具体模型分文件维护，方便单独调形、调灯、调材质 */}
      <WorkstationZone variant={variant} screenData={screenData} />
      <StorageWallZone collections={collections} deployHistory={deployHistory} variant={variant} />
      <LivingCoreZone variant={variant} posts={posts} />
      <SleepZone variant={variant} />
      <WardrobeZone variant={variant} />
      <CeilingAndFloorDetails variant={variant} />
      <NeonSign variant={variant} />
    </group>
  );
}
