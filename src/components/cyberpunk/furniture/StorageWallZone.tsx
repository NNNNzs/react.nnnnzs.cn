'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BlinkingLED, NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';
import type { BookshelfCollection, DeployRecord } from './types';
import type { HomepageSceneVariant } from '../theme';

const SHELF_YS = [0.35, 0.82, 1.29, 1.76, 2.23, 2.7];
const DEFAULT_CORE_COLORS = ['#00f0ff', '#ff2a9a', '#7b61ff', '#6dffb4', '#ffd166', '#00f0ff'];

function DataCore({ position, color, intensity }: { position: [number, number, number]; color: string; intensity: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = Math.abs(position[0] * 13 + position[1] * 7);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = intensity + Math.sin(clock.getElapsedTime() * 1.5 + seed) * 0.15;
  });

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[0.08, 0.28, 0.16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
    </mesh>
  );
}

function CollectionDataCoreGroup({ collection, shelfY, index }: { collection: BookshelfCollection; shelfY: number; index: number }) {
  const [hovered, setHovered] = useState(false);

  const color = collection.color || DEFAULT_CORE_COLORS[index % DEFAULT_CORE_COLORS.length];
  const coreCount = Math.min(3, Math.ceil(collection.articleCount / 10));
  const baseIntensity = 0.3 + Math.min(0.7, collection.articleCount / 40);

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      onClick={() => { window.location.href = `/collections/${collection.slug}`; }}
    >
      {Array.from({ length: coreCount }).map((_, ci) => (
        <DataCore
          key={ci}
          position={[-0.42 + ci * 0.28, shelfY + 0.14, 0.5]}
          color={color}
          intensity={baseIntensity}
        />
      ))}
      {hovered && (
        <Html center distanceFactor={7} zIndexRange={[30, 10]}>
          <div className="pointer-events-none rounded border border-cyan-300/40 bg-[#050611]/85 px-3 py-2 backdrop-blur">
            <div className="text-xs font-semibold text-cyan-100">{collection.title}</div>
            <div className="text-[10px] text-cyan-200/60">{collection.articleCount} 篇文章</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Bookshelf({ collections, variant }: { collections?: BookshelfCollection[]; variant?: HomepageSceneVariant }) {
  const layout = FURNITURE_LAYOUT.bookshelf;
  const isDay = variant === 'day';

  return (
    <EditableGroup id="bookshelf" position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, 0.08]} />
        <meshStandardMaterial color="#0c0c15" metalness={0.5} roughness={0.44} />
      </mesh>
      {[-0.62, 0, 0.62].map((x) => (
        <mesh key={x} position={[x, 1.35, 0.23]}>
          <boxGeometry args={[0.04, layout.bounds.height, 0.38]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      {SHELF_YS.map((y) => (
        <mesh key={y} position={[0, y, 0.24]}>
          <boxGeometry args={[layout.bounds.width, 0.04, 0.42]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      {Array.from({ length: 34 }).map((_, index) => {
        const col = index % 11;
        const row = Math.floor(index / 11);
        const x = -0.54 + col * 0.11;
        const y = 0.48 + row * 0.47;
        const h = 0.2 + ((index * 7) % 8) * 0.018;
        const color = ['#202038', '#29223d', '#1d2840', '#24322c'][index % 4];

        return (
          <mesh key={index} position={[x, y + h / 2, 0.48]}>
            <boxGeometry args={[0.065, h, 0.16]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        );
      })}
      {collections && collections.length > 0
        ? collections.slice(0, 6).map((col, i) => (
            <CollectionDataCoreGroup key={col.id} collection={col} shelfY={SHELF_YS[i]} index={i} />
          ))
        : ['#00f0ff', '#ff2a9a', '#7b61ff', '#6dffb4'].map((color, index) => (
            <mesh key={color} position={[-0.42 + index * 0.28, 2.38, 0.5]}>
              <boxGeometry args={[0.08, 0.28, 0.16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.46} toneMapped={false} />
            </mesh>
          ))}
    </EditableGroup>
  );
}

function ServerUnit({
  row,
  y,
  deployRecord,
  isPulled,
  onToggle,
}: {
  row: number;
  y: number;
  deployRecord?: DeployRecord;
  isPulled: boolean;
  onToggle: (row: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const targetZ = isPulled ? 0.45 : 0.26;
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, targetZ, 0.1);
  });

  const statusColor = deployRecord
    ? deployRecord.status === 'success' ? '#00f0ff'
    : deployRecord.status === 'failure' ? '#ff2a9a'
    : '#ffb347'
    : undefined;

  const timeStr = deployRecord ? new Date(deployRecord.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const shortMsg = deployRecord?.message && deployRecord.message.length > 28
    ? deployRecord.message.slice(0, 28) + '...'
    : deployRecord?.message ?? '';

  return (
    <group
      ref={ref}
      position={[0, y, 0.255]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      onClick={(e) => { e.stopPropagation(); onToggle(row); }}
    >
      {/* 服务器薄板 */}
      <mesh>
        <boxGeometry args={[0.52, 0.08, 0.03]} />
        <meshStandardMaterial
          color={hovered || isPulled ? '#1e1e36' : '#151525'}
          metalness={0.7}
          roughness={0.3}
          emissive={isPulled ? (statusColor ?? '#00f0ff') : '#000000'}
          emissiveIntensity={isPulled ? 0.08 : (hovered ? 0.04 : 0)}
          toneMapped={false}
        />
      </mesh>
      {/* 底部分割线 */}
      <mesh position={[0, -0.045, 0.005]}>
        <boxGeometry args={[0.54, 0.005, 0.035]} />
        <meshStandardMaterial color="#0a0a18" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* LED 灯 */}
      {deployRecord
        ? [0, 1, 2, 3].map((col) => (
            <BlinkingLED key={col} position={[-0.2 + col * 0.12, 0, 0.03]} status={deployRecord.status} />
          ))
        : ['#00f0ff', '#6dffb4', '#ff2a9a', '#7b61ff'].map((color, col) => (
            <BlinkingLED key={col} position={[-0.2 + col * 0.12, 0, 0.03]} color={color} />
          ))}
      {/* 抽拉后详情面板 */}
      {isPulled && deployRecord && (
        <Html center distanceFactor={6} zIndexRange={[30, 10]} position={[0, 0.2, 0]}>
          <div className="pointer-events-none rounded border bg-[#050611]/92 px-3 py-2 backdrop-blur text-[10px] font-mono leading-relaxed whitespace-nowrap"
            style={{ borderColor: `${statusColor ?? '#00f0ff'}44` }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor ?? '#00f0ff', boxShadow: `0 0 6px ${statusColor}` }} />
              <span className="font-semibold" style={{ color: statusColor ?? '#00f0ff' }}>{deployRecord.version} {deployRecord.status.toUpperCase()}</span>
            </div>
            <div className="text-cyan-200/70">{shortMsg}</div>
            <div className="text-cyan-200/40">{deployRecord.commit} · {timeStr}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function ServerRack({ deployHistory }: { deployHistory?: DeployRecord[] }) {
  const layout = FURNITURE_LAYOUT.serverRack;
  const [pulledRow, setPulledRow] = useState<number | null>(null);

  const handleToggle = (row: number) => {
    setPulledRow((prev) => (prev === row ? null : row));
  };

  return (
    <EditableGroup id="server-rack" position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, layout.bounds.depth]} />
        <meshStandardMaterial color="#080812" metalness={0.86} roughness={0.24} />
      </mesh>
      {[0.28, 0.58, 0.88, 1.18, 1.48, 1.78].map((y, row) => (
        <ServerUnit
          key={y}
          row={row}
          y={y}
          deployRecord={deployHistory?.[row * 4]}
          isPulled={pulledRow === row}
          onToggle={handleToggle}
        />
      ))}
      <NeonStrip position={[0.35, 1.0, 0.03]} scale={[0.022, 1.75, 0.025]} color="#00d8ff" intensity={1.2} />
    </EditableGroup>
  );
}

export default function StorageWallZone({ collections, deployHistory, variant }: { collections?: BookshelfCollection[]; deployHistory?: DeployRecord[]; variant?: HomepageSceneVariant }) {
  return (
    <>
      <Bookshelf collections={collections} variant={variant} />
      <ServerRack deployHistory={deployHistory} />

      <EditableGroup id="data-ghost-sign" position={[3.56, 1.58, -3.03]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[0.72, 1.0]} />
          <meshStandardMaterial color="#0b0714" emissive="#7b61ff" emissiveIntensity={0.28} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[0.22, 0.28, 32]} />
          <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={1.2} toneMapped={false} transparent opacity={0.8} />
        </mesh>
        <Text position={[0, -0.42, 0.02]} fontSize={0.08} anchorX="center" anchorY="middle" color="#ffb9ea">
          DATA GHOST
        </Text>
      </EditableGroup>

      <EditableGroup id="kiroshi-index-sign" position={[3.55, 1.38, -0.48]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[1.15, 0.72]} />
          <meshStandardMaterial color="#050712" emissive="#ff2a9a" emissiveIntensity={0.14} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry args={[0.16, 0.19, 36]} />
          <meshStandardMaterial color="#ff2a9a" emissive="#ff2a9a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <Text position={[0, -0.25, 0.025]} fontSize={0.075} anchorX="center" anchorY="middle" color="#7ee7ff">
          KIROSHI INDEX
        </Text>
      </EditableGroup>
    </>
  );
}
