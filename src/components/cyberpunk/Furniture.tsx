/**
 * 家具组件 - 使用代码几何体创建的赛博朋克风格家具
 *
 * 所有模型均为占位几何体（P0），后续替换为 Sketchfab GLB 模型
 *
 * 布局（俯视图）：
 *   左墙              后墙(窗户)              右墙
 *   ┌──────────┬────────────┬──────────┐
 *   │          │            │          │
 *   │   床     │    窗户     │  书架    │
 *   │  (-3,0)  │   (0,1.8)  │  (3,-1)  │
 *   │          │            │  服务器  │
 *   │          │   桌子     │  (3.5,-2) │
 *   │          │  (0.5,0)   │          │
 *   │          │            │          │
 *   └──────────┴────────────┴──────────┘
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ========================
// 共享材质
// ========================

const darkMetal = {
  color: '#1a1a2a',
  metalness: 0.8,
  roughness: 0.3,
};

const darkPlastic = {
  color: '#15152a',
  metalness: 0.3,
  roughness: 0.7,
};

// ========================
// 闪烁 LED 效果
// ========================

function BlinkingLED({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const speed = useMemo(() => 0.5 + Math.random() * 3, []);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      const material = ref.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = Math.sin(clock.getElapsedTime() * speed + offset) > 0 ? 2 : 0.1;
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
}

// ========================
// 桌子
// ========================

function Desk() {
  return (
    <group position={[0.5, 0, 0]}>
      {/* 桌面 */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[1.8, 0.04, 0.8]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 桌腿 */}
      {[
        [-0.8, 0, -0.35] as [number, number, number],
        [0.8, 0, -0.35] as [number, number, number],
        [-0.8, 0, 0.35] as [number, number, number],
        [0.8, 0, 0.35] as [number, number, number],
      ].map((pos, i) => (
        <mesh key={i} position={[pos[0], pos[1] + 0.375, pos[2]]} castShadow>
          <boxGeometry args={[0.04, 0.75, 0.04]} />
          <meshStandardMaterial {...darkMetal} />
        </mesh>
      ))}
    </group>
  );
}

// ========================
// 显示器
// ========================

function Monitor({ position }: { position: [number, number, number] }) {
  const screenRef = useRef<THREE.Mesh>(null);

  // 屏幕微弱闪烁
  useFrame(({ clock }) => {
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + Math.sin(clock.getElapsedTime() * 0.3) * 0.1;
    }
  });

  return (
    <group position={position}>
      {/* 支架 */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.04, 0.15, 0.04]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.1]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 屏幕框 */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.6, 0.38, 0.02]} />
        <meshStandardMaterial color="#0a0a15" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 屏幕发光面 */}
      <mesh ref={screenRef} position={[0, 0.15, 0.011]}>
        <planeGeometry args={[0.55, 0.33]} />
        <meshStandardMaterial
          color="#0a1020"
          emissive="#003344"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// 发光键盘
// ========================

function Keyboard() {
  return (
    <group position={[0.5, 0.78, 0.1]} rotation={[-0.1, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.5, 0.02, 0.18]} />
        <meshStandardMaterial {...darkPlastic} />
      </mesh>
      {/* 按键发光效果（简化为一层发光面） */}
      <mesh position={[0, 0.011, 0]}>
        <planeGeometry args={[0.48, 0.16]} />
        <meshStandardMaterial
          color="#0a0a15"
          emissive="#00f0ff"
          emissiveIntensity={0.15}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// 床
// ========================

function Bed() {
  return (
    <group position={[-3, 0, -0.5]}>
      {/* 床架 */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.4, 0.1, 2]} />
        <meshStandardMaterial color="#15152a" metalness={0.3} roughness={0.8} />
      </mesh>
      {/* 床垫 */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[1.3, 0.15, 1.9]} />
        <meshStandardMaterial color="#1a1a30" roughness={0.95} />
      </mesh>
      {/* 床头板 */}
      <mesh position={[0, 0.5, -1]}>
        <boxGeometry args={[1.4, 0.6, 0.06]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 枕头 */}
      <mesh position={[-0.35, 0.45, -0.7]}>
        <boxGeometry args={[0.35, 0.1, 0.25]} />
        <meshStandardMaterial color="#1e1e35" roughness={1} />
      </mesh>
      <mesh position={[0.35, 0.45, -0.7]}>
        <boxGeometry args={[0.35, 0.1, 0.25]} />
        <meshStandardMaterial color="#1e1e35" roughness={1} />
      </mesh>
    </group>
  );
}

// ========================
// 床头柜
// ========================

function Nightstand() {
  return (
    <group position={[-1.8, 0, -1.2]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.35, 0.5, 0.3]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 全息时钟（简化为发光小方块） */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.2, 0.08, 0.02]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// 书架
// ========================

function Bookshelf() {
  const shelfColor = '#15152a';

  return (
    <group position={[3.2, 0, -0.5]}>
      {/* 侧板 */}
      <mesh position={[-0.4, 1, 0]}>
        <boxGeometry args={[0.04, 2.2, 0.3]} />
        <meshStandardMaterial color={shelfColor} />
      </mesh>
      <mesh position={[0.4, 1, 0]}>
        <boxGeometry args={[0.04, 2.2, 0.3]} />
        <meshStandardMaterial color={shelfColor} />
      </mesh>
      {/* 层板 */}
      {[0, 0.55, 1.1, 1.65, 2.2].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[0.84, 0.03, 0.3]} />
          <meshStandardMaterial color={shelfColor} />
        </mesh>
      ))}
      {/* 发光数据核心（各层随机） */}
      {[
        { pos: [-0.2, 0.3, 0] as [number, number, number], color: '#00f0ff' },
        { pos: [0.15, 0.3, 0] as [number, number, number], color: '#ff0066' },
        { pos: [0, 0.85, 0] as [number, number, number], color: '#00ff88' },
        { pos: [-0.1, 1.4, 0] as [number, number, number], color: '#00f0ff' },
        { pos: [0.2, 1.4, 0] as [number, number, number], color: '#8844ff' },
        { pos: [-0.15, 1.9, 0] as [number, number, number], color: '#ff0066' },
        { pos: [0.1, 1.9, 0] as [number, number, number], color: '#00ff88' },
      ].map((item, i) => (
        <mesh key={`core-${i}`} position={item.pos}>
          <boxGeometry args={[0.08, 0.2, 0.15]} />
          <meshStandardMaterial
            color={item.color}
            emissive={item.color}
            emissiveIntensity={0.5 + Math.random() * 0.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ========================
// 服务器机架
// ========================

function ServerRack() {
  const ledColors = ['#00ff88', '#00f0ff', '#ff0066', '#00ff88', '#00f0ff', '#ff0066', '#00ff88', '#ff0066'];

  return (
    <group position={[3.5, 0, -2.2]}>
      {/* 机架外壳 */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.45, 1.1, 0.35]} />
        <meshStandardMaterial color="#0d0d1a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* 前面板（半透明） */}
      <mesh position={[0, 0.5, 0.178]}>
        <boxGeometry args={[0.4, 1, 0.01]} />
        <meshStandardMaterial
          color="#111122"
          transparent
          opacity={0.5}
          metalness={0.5}
        />
      </mesh>
      {/* LED 指示灯 */}
      {ledColors.map((color, i) => (
        <BlinkingLED
          key={`led-${i}`}
          position={[-0.12 + (i % 4) * 0.08, 0.9 - Math.floor(i / 4) * 0.2, 0.185]}
          color={color}
        />
      ))}
    </group>
  );
}

// ========================
// 椅子
// ========================

function Chair() {
  return (
    <group position={[0.5, 0, 0.8]}>
      {/* 座垫 */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <meshStandardMaterial color="#15152a" roughness={0.9} />
      </mesh>
      {/* 靠背 */}
      <mesh position={[0, 0.75, -0.2]}>
        <boxGeometry args={[0.45, 0.55, 0.05]} />
        <meshStandardMaterial color="#15152a" roughness={0.9} />
      </mesh>
      {/* 中心柱 */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 底座 */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
    </group>
  );
}

// ========================
// 咖啡杯
// ========================

function CoffeeMug() {
  return (
    <group position={[1.2, 0.78, -0.15]}>
      {/* 杯身 */}
      <mesh>
        <cylinderGeometry args={[0.03, 0.025, 0.07, 12]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ========================
// 生物发光盆栽
// ========================

function GlowPlant() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(clock.getElapsedTime() * 1.2) * 0.2;
    }
  });

  return (
    <group position={[-1.5, 0, 1.8]}>
      {/* 花盆 */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 0.2, 8]} />
        <meshStandardMaterial color="#1a1a2a" roughness={0.8} />
      </mesh>
      {/* 发光植物 */}
      <mesh ref={ref} position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
      {/* 小光晕 */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={0.2}
          transparent
          opacity={0.15}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// 霓虹灯牌 "小破站"
// ========================

function NeonSign() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(clock.getElapsedTime() * 2) * 0.3;
    }
  });

  return (
    <group position={[0, 3.0, -2.96]}>
      {/* 霓虹文字占位（用发光平面代替，后续替换为 3D 文字） */}
      <mesh ref={ref}>
        <planeGeometry args={[1.2, 0.3]} />
        <meshStandardMaterial
          color="#ff0066"
          emissive="#ff0066"
          emissiveIntensity={1.5}
          toneMapped={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* 光晕 */}
      <mesh>
        <planeGeometry args={[1.6, 0.6]} />
        <meshStandardMaterial
          color="#ff0066"
          emissive="#ff0066"
          emissiveIntensity={0.3}
          transparent
          opacity={0.1}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// 散落线缆
// ========================

function Cables() {
  return (
    <group>
      {/* 用几根弯曲线条表示 */}
      {[0, 1, 2].map((i) => {
        const points = [
          new THREE.Vector3(0.3 + i * 0.15, 0.02, -0.1 + i * 0.2),
          new THREE.Vector3(0.1 + i * 0.1, 0.01, 0.2 + i * 0.15),
          new THREE.Vector3(-0.1 + i * 0.05, 0.015, 0.5 + i * 0.1),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 12, 0.008, 6, false);
        return (
          <mesh key={i} geometry={tubeGeometry}>
            <meshStandardMaterial color="#0a0a15" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

// ========================
// 主组件 - 组装所有家具
// ========================

export default function Furniture() {
  return (
    <group>
      {/* 工作区 */}
      <Desk />
      <Monitor position={[0.2, 0.78, -0.15]} />
      <Monitor position={[0.85, 0.78, -0.15]} />
      <Keyboard />
      <Cables />

      {/* 睡眠区 */}
      <Bed />
      <Nightstand />

      {/* 存储/服务器区 */}
      <Bookshelf />
      <ServerRack />

      {/* 椅子 */}
      <Chair />

      {/* 小物件 */}
      <CoffeeMug />
      <GlowPlant />

      {/* 标识 */}
      <NeonSign />
    </group>
  );
}
