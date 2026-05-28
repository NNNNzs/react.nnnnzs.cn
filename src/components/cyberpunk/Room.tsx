'use client';

import type { HomepageSceneVariant } from './theme';
import FloorSection from './room/FloorSection';
import WallSection from './room/WallSection';
import PipeSystem from './room/PipeSystem';
import WindowScene from './room/WindowScene';
import RoomDetails from './room/RoomDetails';

export default function Room({ variant = 'night' }: { variant?: HomepageSceneVariant }) {
  return (
    <group>
      {/* 房间层同样保持“装配层”职责，避免把布局和几何都塞进一个大组件 */}
      <FloorSection variant={variant} />
      <WallSection variant={variant} />
      <PipeSystem variant={variant} />
      <WindowScene variant={variant} />
      <RoomDetails variant={variant} />
    </group>
  );
}
