'use client';

import MonitorModel from './MonitorModel';
import { BlinkingLED, NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';

function WorkstationDesk() {
  const desk = FURNITURE_LAYOUT.desk;

  return (
    <group position={desk.position}>
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[desk.bounds.width, 0.08, desk.bounds.depth]} />
        <meshStandardMaterial color="#181018" metalness={0.28} roughness={0.72} />
      </mesh>
      <NeonStrip position={[0, 0.74, desk.bounds.depth / 2 + 0.02]} scale={[desk.bounds.width, 0.018, 0.018]} color="#00d8ff" intensity={1.1} />
      {[
        [-1.15, 0.38, -0.34],
        [1.15, 0.38, -0.34],
        [-1.15, 0.38, 0.34],
        [1.15, 0.38, 0.34],
      ].map((pos, index) => (
        <mesh key={index} position={pos as [number, number, number]}>
          <boxGeometry args={[0.06, 0.76, 0.06]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      <mesh position={[-0.94, 0.34, 0.26]}>
        <boxGeometry args={[0.62, 0.56, 0.38]} />
        <meshStandardMaterial color="#090914" metalness={0.72} roughness={0.26} />
      </mesh>
      {['#00f0ff', '#ff2a9a', '#6dffb4'].map((color, index) => (
        <BlinkingLED key={color} position={[-1.08 + index * 0.13, 0.48, 0.45]} color={color} />
      ))}
    </group>
  );
}

function WorkstationAccessories() {
  return (
    <>
      <mesh position={FURNITURE_LAYOUT.keyboard.position} rotation={FURNITURE_LAYOUT.keyboard.rotation}>
        <boxGeometry args={[0.78, 0.035, 0.24]} />
        <meshStandardMaterial color="#070711" metalness={0.4} roughness={0.58} />
      </mesh>
      <NeonStrip position={[-2.18, 0.865, -1.68]} scale={[0.68, 0.008, 0.03]} color="#ff2a9a" intensity={0.8} />
      <mesh position={FURNITURE_LAYOUT.mouse.position}>
        <boxGeometry args={[0.08, 0.035, 0.13]} />
        <meshStandardMaterial color="#080812" emissive="#00f0ff" emissiveIntensity={0.14} />
      </mesh>
      <mesh position={FURNITURE_LAYOUT.coffeeMug.position}>
        <cylinderGeometry args={[0.045, 0.04, 0.1, 14]} />
        <meshStandardMaterial color="#202033" roughness={0.72} />
      </mesh>
    </>
  );
}

export default function WorkstationZone() {
  return (
    <EditableGroup id="workstation-zone">
      <WorkstationDesk />

      {FURNITURE_LAYOUT.monitors.map((monitor) => (
        <MonitorModel
          key={monitor.variant}
          position={monitor.position}
          rotation={monitor.rotation}
          variant={monitor.variant}
        />
      ))}

      <WorkstationAccessories />
    </EditableGroup>
  );
}
