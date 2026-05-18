/**
 * 赛博朋克房间几何体
 * 地板、墙壁、天花板、窗户（带城市天际线）
 *
 * 房间尺寸：宽 8 x 深 6 x 高 3.5
 * 相机位置：(0, 2.2, 6) 朝向 (0, 1.2, -1)
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ========================
// 常量
// ========================

const ROOM = { width: 8, depth: 6, height: 3.5 };
const WALL_COLOR = '#0d0d1a';
const FLOOR_COLOR = '#121220';
const CEILING_COLOR = '#0a0a14';

// ========================
// 程序化城市天际线纹理
// ========================

function createCityTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 夜空渐变
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#05050f');
  skyGrad.addColorStop(0.5, '#0a0a20');
  skyGrad.addColorStop(1, '#15153a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1024, 256);

  // 建筑剪影
  const buildings: Array<{ x: number; w: number; h: number }> = [];
  for (let i = 0; i < 40; i++) {
    const x = i * 28 + Math.random() * 10;
    const w = 15 + Math.random() * 20;
    const h = 60 + Math.random() * 180;
    buildings.push({ x, w, h });
  }

  // 绘制建筑
  buildings.forEach((b) => {
    const grad = ctx.createLinearGradient(b.x, 256 - b.h, b.x, 256);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(1, '#151525');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, 256 - b.h, b.w, b.h);

    // 窗户灯光
    for (let wy = 256 - b.h + 5; wy < 250; wy += 8) {
      for (let wx = b.x + 3; wx < b.x + b.w - 3; wx += 6) {
        if (Math.random() > 0.4) {
          const colors = ['#00f0ff', '#ff0066', '#00ff88', '#ffaa00', '#ffffff', '#8844ff'];
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          ctx.globalAlpha = 0.1 + Math.random() * 0.4;
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    ctx.globalAlpha = 1;
  });

  // 地面反光
  const groundGrad = ctx.createLinearGradient(0, 256, 0, 512);
  groundGrad.addColorStop(0, '#15153a');
  groundGrad.addColorStop(0.3, '#0a0a20');
  groundGrad.addColorStop(1, '#050510');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 256, 1024, 256);

  // 霓虹光晕
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * 1024;
    const cy = 200 + Math.random() * 100;
    const r = 30 + Math.random() * 60;
    const neonColors = ['#00f0ff', '#ff0066', '#00ff88'];
    const color = neonColors[Math.floor(Math.random() * neonColors.length)];
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    radGrad.addColorStop(0, color + '40');
    radGrad.addColorStop(1, color + '00');
    ctx.fillStyle = radGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// ========================
// 程序化地板纹理
// ========================

function createFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 基础深色
  ctx.fillStyle = '#121220';
  ctx.fillRect(0, 0, 512, 512);

  // 网格线（模拟地砖）
  ctx.strokeStyle = '#1a1a30';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 64);
    ctx.lineTo(512, i * 64);
    ctx.stroke();
  }

  // 随机污渍/反光
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 5 + Math.random() * 20;
    const radGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.03)');
    radGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// ========================
// 主组件
// ========================

export default function Room() {
  const cityTexture = useMemo(() => createCityTexture(), []);
  const floorTexture = useMemo(() => createFloorTexture(), []);
  const windowMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  // 窗户微弱的雨光效果
  useFrame(({ clock }) => {
    if (windowMaterialRef.current) {
      const t = clock.getElapsedTime();
      windowMaterialRef.current.emissiveIntensity = 0.4 + Math.sin(t * 0.5) * 0.05;
    }
  });

  const hw = ROOM.width / 2;
  const hh = ROOM.height;

  return (
    <group>
      {/* ========== 地板 ========== */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial
          map={floorTexture}
          color={FLOOR_COLOR}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* ========== 后墙（窗户所在墙） ========== */}
      <mesh position={[0, hh / 2, -ROOM.depth / 2]}>
        <planeGeometry args={[ROOM.width, hh]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>

      {/* ========== 左墙 ========== */}
      <mesh
        position={[-hw, hh / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[ROOM.depth, hh]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>

      {/* ========== 右墙 ========== */}
      <mesh
        position={[hw, hh / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[ROOM.depth, hh]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>

      {/* ========== 天花板 ========== */}
      <mesh position={[0, hh, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial color={CEILING_COLOR} roughness={1} />
      </mesh>

      {/* ========== 天花板管道（装饰） ========== */}
      {[
        { pos: [-1.5, 3.3, -1.5] as [number, number, number], length: 4 },
        { pos: [2, 3.4, 0.5] as [number, number, number], length: 5 },
        { pos: [0, 3.35, -2] as [number, number, number], length: 6 },
      ].map((pipe, i) => (
        <mesh key={`pipe-${i}`} position={pipe.pos}>
          <cylinderGeometry args={[0.03, 0.03, pipe.length, 8]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* ========== 窗户（后墙中央，带城市天际线） ========== */}
      <mesh
        position={[0, 1.8, -ROOM.depth / 2 + 0.02]}
        ref={windowMaterialRef as React.Ref<THREE.Mesh>}
      >
        <planeGeometry args={[4, 2.5]} />
        <meshStandardMaterial
          map={cityTexture}
          emissiveMap={cityTexture}
          emissive="#334466"
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* 窗框 */}
      <group position={[0, 1.8, -ROOM.depth / 2 + 0.03]}>
        {/* 外框 */}
        <mesh>
          <boxGeometry args={[4.2, 0.06, 0.06]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.06, 2.6, 0.06]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* 中间十字框 */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[4, 0.04, 0.04]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.04, 2.5, 0.04]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* ========== 霓虹灯条（天花板装饰） ========== */}
      <mesh position={[-2, 3.3, -1]}>
        <boxGeometry args={[2, 0.02, 0.02]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[2, 3.4, -2]}>
        <boxGeometry args={[1.5, 0.02, 0.02]} />
        <meshStandardMaterial
          color="#ff0066"
          emissive="#ff0066"
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      {/* ========== 踢脚线（微弱霓虹反光） ========== */}
      <mesh position={[0, 0.03, -ROOM.depth / 2 + 0.02]}>
        <boxGeometry args={[ROOM.width, 0.06, 0.02]} />
        <meshStandardMaterial
          color="#0a0a15"
          emissive="#00f0ff"
          emissiveIntensity={0.1}
        />
      </mesh>
    </group>
  );
}
