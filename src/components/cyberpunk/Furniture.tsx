'use client';

import type { HomepageSceneVariant } from './theme';
import WorkstationZone from './furniture/WorkstationZone';
import StorageWallZone from './furniture/StorageWallZone';
import LivingCoreZone from './furniture/LivingCoreZone';
import SleepZone from './furniture/SleepZone';
import WardrobeZone from './furniture/WardrobeZone';
import CeilingAndFloorDetails from './furniture/CeilingAndFloorDetails';
import NeonSign from './furniture/NeonSign';

export default function Furniture({ variant = 'night' }: { variant?: HomepageSceneVariant }) {
  return (
    <group>
      {/* 家具层只做装配，具体模型分文件维护，方便单独调形、调灯、调材质 */}
      <WorkstationZone />
      <StorageWallZone />
      <LivingCoreZone variant={variant} />
      <SleepZone />
      <WardrobeZone />
      <CeilingAndFloorDetails variant={variant} />
      <NeonSign variant={variant} />
    </group>
  );
}
