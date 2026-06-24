'use client';

import MonitorModel from './MonitorModel';
import { BlinkingLED, NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';
import type { ScreenTextureData } from './types';
import type { HomepageSceneVariant } from '../theme';

function WorkstationDesk({ variant }: { variant: HomepageSceneVariant }) {
  const desk = FURNITURE_LAYOUT.desk;
  const legX = desk.bounds.width / 2 - 0.13;
  const legZ = desk.bounds.depth / 2 - 0.09;
  const isDay = variant === 'day';

  return (
    <group position={desk.position}>
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[desk.bounds.width, 0.08, desk.bounds.depth]} />
        <meshStandardMaterial color={isDay ? '#8b6845' : '#181018'} metalness={isDay ? 0.08 : 0.28} roughness={isDay ? 0.78 : 0.72} />
      </mesh>
      <NeonStrip
        position={[0, 0.74, desk.bounds.depth / 2 + 0.02]}
        scale={[desk.bounds.width, 0.018, 0.018]}
        color={isDay ? '#facc15' : '#00d8ff'}
        intensity={isDay ? 0.18 : 1.1}
      />
      {[
        [-legX, 0.38, -legZ],
        [legX, 0.38, -legZ],
        [-legX, 0.38, legZ],
        [legX, 0.38, legZ],
      ].map((pos, index) => (
        <mesh key={index} position={pos as [number, number, number]}>
          <boxGeometry args={[0.06, 0.76, 0.06]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      <mesh position={[-1.05, 0.34, 0.17]}>
        <boxGeometry args={[0.52, 0.56, 0.34]} />
        <meshStandardMaterial color={isDay ? '#d1d5db' : '#090914'} metalness={isDay ? 0.35 : 0.72} roughness={isDay ? 0.48 : 0.26} />
      </mesh>
      {(isDay ? ['#38bdf8', '#f59e0b', '#22c55e'] : ['#00f0ff', '#ff2a9a', '#6dffb4']).map((color, index) => (
        <BlinkingLED key={color} position={[-1.16 + index * 0.13, 0.48, 0.36]} color={color} />
      ))}
    </group>
  );
}

function WorkstationAccessories({ variant }: { variant: HomepageSceneVariant }) {
  const isDay = variant === 'day';

  return (
    <>
      <mesh position={FURNITURE_LAYOUT.keyboard.position} rotation={FURNITURE_LAYOUT.keyboard.rotation}>
        <boxGeometry args={[0.78, 0.035, 0.24]} />
        <meshStandardMaterial color={isDay ? '#e5e7eb' : '#070711'} metalness={isDay ? 0.12 : 0.4} roughness={isDay ? 0.72 : 0.58} />
      </mesh>
      <NeonStrip position={[-2.16, 0.865, -1.66]} scale={[0.68, 0.008, 0.03]} color={isDay ? '#fbbf24' : '#ff2a9a'} intensity={isDay ? 0.12 : 0.8} />
      <mesh position={FURNITURE_LAYOUT.mouse.position}>
        <boxGeometry args={[0.08, 0.035, 0.13]} />
        <meshStandardMaterial color={isDay ? '#f8fafc' : '#080812'} emissive={isDay ? '#fde68a' : '#00f0ff'} emissiveIntensity={isDay ? 0.025 : 0.14} />
      </mesh>
      <mesh position={FURNITURE_LAYOUT.coffeeMug.position}>
        <cylinderGeometry args={[0.045, 0.04, 0.1, 14]} />
        <meshStandardMaterial color={isDay ? '#f5efe7' : '#202033'} roughness={0.72} />
      </mesh>
    </>
  );
}

export default function WorkstationZone({
  variant,
  screenData,
}: {
  variant: HomepageSceneVariant;
  screenData?: [ScreenTextureData, ScreenTextureData, ScreenTextureData];
}) {
  return (
    <EditableGroup id="workstation-zone">
      <WorkstationDesk variant={variant} />

      {FURNITURE_LAYOUT.monitors.map((monitor, i) => (
        <MonitorModel
          key={monitor.variant}
          position={monitor.position}
          rotation={monitor.rotation}
          variant={monitor.variant}
          sceneVariant={variant}
          screenData={screenData?.[i]}
        />
      ))}

      <WorkstationAccessories variant={variant} />
    </EditableGroup>
  );
}
