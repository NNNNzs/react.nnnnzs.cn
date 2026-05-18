/**
 * 家具组件 - 赛博朋克单人公寓完整家具布局
 *
 * 布局（俯视图，从入口 Z+ 看向 Z-）：
 *   左墙(-3)          后墙(落地窗 Z-4)        右墙(+3)
 *   ┌──────────┬────────────────────┬──────────┐
 *   │          │                    │          │
 *   │  床(-2)  │   ████████████     │ 书架(+2.5)│
 *   │  生活区   │   █  城市夜景  █    │ 服务器(+2.8)│
 *   │  Z=-1   │   桌子(+1.2,Z-2)  │  Z=-2.5  │
 *   │  海报    │   三显示器          │          │
 *   │          │   椅子(+1.2,Z-0.8) │          │
 *   │ 植物     │                    │          │
 *   └──────────┴────────────────────┴──────────┘
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
// 程序化显示器 HUD 纹理
// ========================

function createScreenTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  // 深色背景
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, 512, 320);

  if (variant === 0) {
    // 代码界面
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(10, 10, 492, 300);
    // 侧边栏
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(10, 10, 80, 300);
    // 代码行
    const codeColors = ['#00f0ff', '#ff0066', '#00ff88', '#ffaa00', '#8844ff', '#ffffff'];
    for (let y = 20; y < 300; y += 8) {
      for (let x = 100; x < 490; x += 3 + Math.random() * 5) {
        ctx.fillStyle = codeColors[Math.floor(Math.random() * codeColors.length)];
        ctx.globalAlpha = 0.3 + Math.random() * 0.5;
        ctx.fillRect(x, y, 2 + Math.random() * 3, 4);
      }
    }
    // 行号
    for (let y = 20; y < 300; y += 12) {
      ctx.fillStyle = '#334455';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(18, y, 20, 5);
    }
  } else if (variant === 1) {
    // 地图/监控界面
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(10, 10, 492, 300);
    // 网格线
    ctx.strokeStyle = '#1a2040';
    ctx.lineWidth = 0.5;
    for (let x = 10; x < 500; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 310); ctx.stroke();
    }
    for (let y = 10; y < 310; y += 30) {
      ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(500, y); ctx.stroke();
    }
    // 地图标记点
    const mapColors = ['#00f0ff', '#ff0066', '#00ff88'];
    for (let i = 0; i < 15; i++) {
      const mx = 30 + Math.random() * 450;
      const my = 30 + Math.random() * 260;
      const mc = mapColors[Math.floor(Math.random() * 3)];
      ctx.fillStyle = mc;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(mx, my, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // HUD 框
    ctx.strokeStyle = '#00f0ff';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, 470, 280);
  } else {
    // 系统状态面板
    ctx.fillStyle = '#080815';
    ctx.fillRect(10, 10, 492, 300);
    // 面板块
    const panelColors = ['#0a1525', '#150a20', '#0a180a'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = panelColors[i % 3];
      ctx.globalAlpha = 0.8;
      const px = 15 + (i % 3) * 160;
      const py = 15 + Math.floor(i / 3) * 150;
      ctx.fillRect(px, py, 150, 140);
      // 进度条/数据
      const barColor = ['#00f0ff', '#ff0066', '#00ff88'][i % 3];
      ctx.fillStyle = barColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(px + 10, py + 30, 80 + Math.random() * 50, 8);
      ctx.fillRect(px + 10, py + 50, 60 + Math.random() * 70, 8);
      ctx.fillRect(px + 10, py + 70, 90 + Math.random() * 40, 8);
    }
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

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
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
    </mesh>
  );
}

// ========================
// 桌子（工业风，深色旧木板桌面）
// ========================

function Desk() {
  return (
    <group position={[1.2, 0, -2]}>
      {/* 桌面 - 更宽更长 */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[2.2, 0.04, 0.85]} />
        <meshStandardMaterial color="#1a1510" metalness={0.2} roughness={0.85} />
      </mesh>
      {/* 金属支架桌腿 */}
      {[
        [-1.0, 0, -0.37] as [number, number, number],
        [1.0, 0, -0.37] as [number, number, number],
        [-1.0, 0, 0.37] as [number, number, number],
        [1.0, 0, 0.37] as [number, number, number],
      ].map((pos, i) => (
        <mesh key={i} position={[pos[0], 0.375, pos[2]]} castShadow>
          <boxGeometry args={[0.04, 0.75, 0.04]} />
          <meshStandardMaterial {...darkMetal} />
        </mesh>
      ))}
      {/* 桌下横撑 */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[2.0, 0.03, 0.03]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
    </group>
  );
}

// ========================
// 显示器（带 HUD 纹理）
// ========================

function Monitor({ position, variant = 0, rotY = 0 }: { position: [number, number, number]; variant?: number; rotY?: number }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const screenTexture = useMemo(() => createScreenTexture(variant), [variant]);

  useFrame(({ clock }) => {
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + Math.sin(clock.getElapsedTime() * 0.3 + variant) * 0.1;
    }
  });

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* 支架 */}
      <mesh>
        <boxGeometry args={[0.04, 0.18, 0.04]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.12]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 屏幕框 - 窄边框 */}
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[0.62, 0.4, 0.02]} />
        <meshStandardMaterial color="#0a0a15" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 屏幕发光面 */}
      <mesh ref={screenRef} position={[0, 0.17, 0.011]}>
        <planeGeometry args={[0.57, 0.35]} />
        <meshStandardMaterial
          map={screenTexture}
          emissiveMap={screenTexture}
          emissive="#003344"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// RGB 机械键盘
// ========================

function Keyboard() {
  return (
    <group position={[1.2, 0.78, -1.7]} rotation={[-0.08, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.55, 0.02, 0.2]} />
        <meshStandardMaterial {...darkPlastic} />
      </mesh>
      {/* RGB 按键发光面 */}
      <mesh position={[0, 0.012, 0]}>
        <planeGeometry args={[0.53, 0.18]} />
        <meshStandardMaterial
          color="#0a0a15"
          emissive="#00f0ff"
          emissiveIntensity={0.2}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// 鼠标
// ========================

function Mouse() {
  return (
    <mesh position={[1.55, 0.78, -1.65]}>
      <boxGeometry args={[0.06, 0.025, 0.1]} />
      <meshStandardMaterial {...darkPlastic} />
    </mesh>
  );
}

// ========================
// 床（凌乱单人床）
// ========================

function Bed() {
  return (
    <group position={[-2, 0, -1.5]}>
      {/* 床架 - 低矮 */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[1.3, 0.1, 2]} />
        <meshStandardMaterial color="#15152a" metalness={0.3} roughness={0.8} />
      </mesh>
      {/* 床垫 */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.2, 0.14, 1.9]} />
        <meshStandardMaterial color="#1a1a30" roughness={0.95} />
      </mesh>
      {/* 凌乱被褥（用几个倾斜的盒子模拟） */}
      <mesh position={[0.1, 0.38, 0.2]} rotation={[0.05, 0.15, 0.03]}>
        <boxGeometry args={[1.1, 0.15, 1.3]} />
        <meshStandardMaterial color="#16162e" roughness={1} />
      </mesh>
      {/* 被角堆起 */}
      <mesh position={[-0.3, 0.4, 0.6]} rotation={[0.1, -0.2, 0.08]}>
        <boxGeometry args={[0.5, 0.2, 0.4]} />
        <meshStandardMaterial color="#181832" roughness={1} />
      </mesh>
      {/* 床头板 */}
      <mesh position={[0, 0.4, -1]}>
        <boxGeometry args={[1.3, 0.5, 0.06]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 枕头（略微偏移表示用过） */}
      <mesh position={[-0.25, 0.38, -0.7]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.35, 0.1, 0.25]} />
        <meshStandardMaterial color="#1e1e38" roughness={1} />
      </mesh>
      <mesh position={[0.2, 0.37, -0.65]} rotation={[0, 0, -0.05]}>
        <boxGeometry args={[0.3, 0.08, 0.22]} />
        <meshStandardMaterial color="#1c1c36" roughness={1} />
      </mesh>
    </group>
  );
}

// ========================
// 床头柜 + 全息时钟
// ========================

function Nightstand() {
  const clockRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (clockRef.current) {
      const mat = clockRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(clock.getElapsedTime() * 1) * 0.15;
    }
  });

  return (
    <group position={[-1.1, 0, -2.3]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.35, 0.5, 0.3]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 全息数字时钟 */}
      <mesh ref={clockRef} position={[0, 0.55, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.02]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ========================
// 墙面霓虹海报/装饰画
// ========================

function NeonPoster() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 1.5) * 0.15;
    }
  });

  return (
    <group position={[-2.97, 1.8, -1.5]} rotation={[0, Math.PI / 2, 0]}>
      {/* 海报背景 */}
      <mesh ref={ref}>
        <planeGeometry args={[0.8, 0.5]} />
        <meshStandardMaterial
          color="#ff0066"
          emissive="#ff0066"
          emissiveIntensity={0.6}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* 装饰框 */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[0.85, 0.55]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.3} toneMapped={false} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ========================
// 书架（整面高书架，工业金属架）
// ========================

function Bookshelf() {
  const shelfColor = '#15152a';

  return (
    <group position={[2.5, 0, -1.5]} rotation={[0, -Math.PI / 2, 0]}>
      {/* 侧板 - 接近天花板高度 */}
      <mesh position={[-0.4, 1.5, 0]}>
        <boxGeometry args={[0.04, 3.2, 0.35]} />
        <meshStandardMaterial color={shelfColor} metalness={0.5} />
      </mesh>
      <mesh position={[0.4, 1.5, 0]}>
        <boxGeometry args={[0.04, 3.2, 0.35]} />
        <meshStandardMaterial color={shelfColor} metalness={0.5} />
      </mesh>
      {/* 层板（6 层） */}
      {[0, 0.64, 1.28, 1.92, 2.56, 3.2].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[0.84, 0.03, 0.35]} />
          <meshStandardMaterial color={shelfColor} metalness={0.5} />
        </mesh>
      ))}

      {/* 发光数据核心（各层随机） */}
      {[
        { pos: [-0.2, 0.35, 0] as [number, number, number], color: '#00f0ff' },
        { pos: [0.15, 0.35, 0] as [number, number, number], color: '#ff0066' },
        { pos: [0, 0.9, 0] as [number, number, number], color: '#00f0ff' },
        { pos: [-0.15, 1.0, 0] as [number, number, number], color: '#8844ff' },
        { pos: [0.2, 1.0, 0] as [number, number, number], color: '#00ff88' },
        { pos: [-0.1, 1.55, 0] as [number, number, number], color: '#00f0ff' },
        { pos: [0.2, 1.55, 0] as [number, number, number], color: '#ff0066' },
        { pos: [0, 2.2, 0] as [number, number, number], color: '#8844ff' },
        { pos: [-0.2, 2.2, 0] as [number, number, number], color: '#00f0ff' },
        { pos: [0.15, 2.85, 0] as [number, number, number], color: '#00ff88' },
        { pos: [-0.1, 2.85, 0] as [number, number, number], color: '#ff0066' },
      ].map((item, i) => (
        <mesh key={`core-${i}`} position={item.pos}>
          <boxGeometry args={[0.08, 0.2, 0.2]} />
          <meshStandardMaterial
            color={item.color}
            emissive={item.color}
            emissiveIntensity={0.4 + Math.random() * 0.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* 盒式存储模块 */}
      {[
        { pos: [-0.25, 0.55, 0] as [number, number, number] },
        { pos: [0.1, 0.55, 0] as [number, number, number] },
        { pos: [0.25, 1.2, 0] as [number, number, number] },
      ].map((item, i) => (
        <mesh key={`module-${i}`} position={item.pos}>
          <boxGeometry args={[0.06, 0.15, 0.18]} />
          <meshStandardMaterial color="#1a1a30" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ========================
// 服务器机柜（大型，1.8m 高）
// ========================

function ServerRack() {
  const ledColors = [
    '#00f0ff', '#00f0ff', '#ff0066', '#00f0ff',
    '#8844ff', '#00f0ff', '#ff0066', '#00f0ff',
    '#00f0ff', '#8844ff', '#ff0066', '#00f0ff',
    '#ff0066', '#00f0ff', '#8844ff', '#00f0ff',
  ];

  return (
    <group position={[2.8, 0, -3]}>
      {/* 机架外壳 - 1.8m 高 */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.5, 1.8, 0.4]} />
        <meshStandardMaterial color="#0d0d1a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* 前面板（半透明） */}
      <mesh position={[0, 0.9, 0.205]}>
        <boxGeometry args={[0.45, 1.7, 0.01]} />
        <meshStandardMaterial color="#111122" transparent opacity={0.4} metalness={0.5} />
      </mesh>
      {/* 设备层分隔条 */}
      {[0, 0.45, 0.9, 1.35, 1.8].map((y, i) => (
        <mesh key={`shelf-${i}`} position={[0, y, 0.21]}>
          <boxGeometry args={[0.44, 0.02, 0.02]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.8} />
        </mesh>
      ))}
      {/* LED 指示灯（16 个，4x4 网格） */}
      {ledColors.map((color, i) => (
        <BlinkingLED
          key={`led-${i}`}
          position={[-0.15 + (i % 4) * 0.1, 1.65 - Math.floor(i / 4) * 0.4, 0.215]}
          color={color}
        />
      ))}
      {/* 散热孔视觉暗示 */}
      <mesh position={[0, 0.9, 0.22]}>
        <planeGeometry args={[0.3, 1.5]} />
        <meshStandardMaterial color="#0a0a15" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// ========================
// 普通办公椅 + 椅背外套
// ========================

function Chair() {
  return (
    <group position={[1.2, 0, -0.8]}>
      {/* 座垫 */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <meshStandardMaterial color="#1a1a28" roughness={0.9} />
      </mesh>
      {/* 靠背 */}
      <mesh position={[0, 0.78, -0.2]}>
        <boxGeometry args={[0.45, 0.6, 0.05]} />
        <meshStandardMaterial color="#1a1a28" roughness={0.9} />
      </mesh>
      {/* 椅背外套 */}
      <mesh position={[0.02, 0.85, -0.23]} rotation={[0.1, 0.05, 0.08]}>
        <boxGeometry args={[0.35, 0.5, 0.04]} />
        <meshStandardMaterial color="#15152a" roughness={1} />
      </mesh>
      {/* 外套袖子部分 */}
      <mesh position={[0.1, 0.65, -0.22]} rotation={[0.3, 0, 0.15]}>
        <boxGeometry args={[0.15, 0.3, 0.03]} />
        <meshStandardMaterial color="#15152a" roughness={1} />
      </mesh>
      {/* 中心柱 */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 底座 */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.02, 16]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      {/* 轮子 */}
      {[
        [0.15, 0.02, 0.15] as [number, number, number],
        [-0.15, 0.02, 0.15] as [number, number, number],
        [0.15, 0.02, -0.15] as [number, number, number],
        [-0.15, 0.02, -0.15] as [number, number, number],
      ].map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#0a0a15" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ========================
// 咖啡杯
// ========================

function CoffeeMug() {
  return (
    <group position={[2.0, 0.78, -1.85]}>
      {/* 杯身 */}
      <mesh>
        <cylinderGeometry args={[0.035, 0.03, 0.08, 12]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.8} />
      </mesh>
      {/* 杯把手 */}
      <mesh position={[0.04, 0, 0]}>
        <torusGeometry args={[0.02, 0.005, 8, 12, Math.PI]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ========================
// 生物发光植物（窗边角落）
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
    <group position={[-2.5, 0, -3.2]}>
      {/* 花盆 */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 0.2, 8]} />
        <meshStandardMaterial color="#1a1a2a" roughness={0.8} />
      </mesh>
      {/* 发光植物主体 */}
      <mesh ref={ref} position={[0, 0.3, 0]}>
        <dodecahedronGeometry args={[0.1, 1]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
      {/* 叶片边缘发光 */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[
          Math.cos(i * Math.PI / 2) * 0.12,
          0.25 + Math.sin(i * 1.5) * 0.05,
          Math.sin(i * Math.PI / 2) * 0.12,
        ]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
      ))}
      {/* 光晕 */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.15} transparent opacity={0.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ========================
// 霓虹灯牌 "小破站"（落地窗上方悬挂）
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
    <group position={[0, 3.55, -3.95]}>
      {/* 悬挂线 */}
      <mesh position={[-0.4, 0.15, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      <mesh position={[0.4, 0.15, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      {/* 霓虹文字占位（发光平面，后续替换 3D 文字） */}
      <mesh ref={ref}>
        <planeGeometry args={[1.4, 0.35]} />
        <meshStandardMaterial
          color="#ff0066"
          emissive="#ff0066"
          emissiveIntensity={1.5}
          toneMapped={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* 青蓝边框 */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[1.5, 0.45]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={0.5}
          toneMapped={false}
          transparent
          opacity={0.2}
        />
      </mesh>
      {/* 大光晕（投射到周围墙面） */}
      <mesh>
        <planeGeometry args={[2.5, 1.0]} />
        <meshStandardMaterial
          color="#ff0066"
          emissive="#ff0066"
          emissiveIntensity={0.15}
          transparent
          opacity={0.08}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ========================
// 散落线缆（地面和工作区）
// ========================

function Cables() {
  return (
    <group>
      {/* 工作区桌下线缆 */}
      {[0, 1, 2, 3].map((i) => {
        const points = [
          new THREE.Vector3(0.5 + i * 0.2, 0.02, -1.8 + i * 0.1),
          new THREE.Vector3(0.3 + i * 0.1, 0.01, -1.5 + i * 0.15),
          new THREE.Vector3(0.0 + i * 0.05, 0.015, -1.2 + i * 0.1),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 12, 0.008, 6, false);
        return (
          <mesh key={`desk-cable-${i}`} geometry={tubeGeometry}>
            <meshStandardMaterial color="#0a0a15" roughness={0.9} />
          </mesh>
        );
      })}
      {/* 服务器区线缆 */}
      {[0, 1].map((i) => {
        const points = [
          new THREE.Vector3(2.5, 0.02, -2.8 + i * 0.3),
          new THREE.Vector3(2.3, 0.01, -2.5 + i * 0.2),
          new THREE.Vector3(2.1, 0.015, -2.2 + i * 0.15),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 10, 0.006, 6, false);
        return (
          <mesh key={`server-cable-${i}`} geometry={tubeGeometry}>
            <meshStandardMaterial color="#0a0a15" roughness={0.9} />
          </mesh>
        );
      })}
      {/* 地面跨区域长线缆 */}
      {(() => {
        const points = [
          new THREE.Vector3(1.5, 0.01, -1.5),
          new THREE.Vector3(0.5, 0.02, 0),
          new THREE.Vector3(-0.5, 0.01, 1),
          new THREE.Vector3(-1, 0.015, 2),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.007, 6, false);
        return (
          <mesh geometry={tubeGeometry}>
            <meshStandardMaterial color="#080812" roughness={0.95} />
          </mesh>
        );
      })()}
    </group>
  );
}

// ========================
// 机器人宠物（机械狗，桌面附近地面）
// ========================

function RobotPet() {
  const bodyRef = useRef<THREE.Mesh>(null);
  const eyeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (eyeRef.current) {
      const mat = eyeRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 0.5) * 0.3;
    }
  });

  return (
    <group position={[1.8, 0, -1.2]} rotation={[0, -0.5, 0]}>
      {/* 身体 */}
      <mesh ref={bodyRef} position={[0, 0.12, 0]}>
        <boxGeometry args={[0.15, 0.08, 0.25]} />
        <meshStandardMaterial color="#1a1a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 头部 */}
      <mesh position={[0, 0.2, 0.12]}>
        <boxGeometry args={[0.1, 0.08, 0.1]} />
        <meshStandardMaterial color="#15152a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 眼睛（LED） */}
      <mesh ref={eyeRef} position={[0.02, 0.22, 0.175]}>
        <boxGeometry args={[0.04, 0.02, 0.01]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {/* 四条腿 */}
      {[
        [0.05, 0, 0.08] as [number, number, number],
        [-0.05, 0, 0.08] as [number, number, number],
        [0.05, 0, -0.08] as [number, number, number],
        [-0.05, 0, -0.08] as [number, number, number],
      ].map((pos, i) => (
        <mesh key={`leg-${i}`} position={[pos[0], 0.05, pos[2]]}>
          <boxGeometry args={[0.025, 0.1, 0.025]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* 尾巴天线 */}
      <mesh position={[0, 0.24, -0.1]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 4]} />
        <meshStandardMaterial color="#1a1a2a" metalness={0.7} />
      </mesh>
    </group>
  );
}

// ========================
// 电子零件/杂物
// ========================

function DeskClutter() {
  return (
    <group>
      {/* 数据模块 */}
      <mesh position={[0.5, 0.78, -2.2]}>
        <boxGeometry args={[0.06, 0.02, 0.06]} />
        <meshStandardMaterial color="#1a1a30" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* 小电路板 */}
      <mesh position={[0.7, 0.77, -2.25]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.05, 0.01, 0.08]} />
        <meshStandardMaterial color="#0a2a1a" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* 工具 */}
      <mesh position={[1.8, 0.78, -2.1]} rotation={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
        <meshStandardMaterial color="#2a2a3a" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ========================
// 衣物/杂物（床附近，生活痕迹）
// ========================

function LivingClutter() {
  return (
    <group>
      {/* 地上杂志 */}
      <mesh position={[-1.5, 0.01, 0.5]} rotation={[-Math.PI / 2, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.005, 0.28]} />
        <meshStandardMaterial color="#1a1520" roughness={0.95} />
      </mesh>
      {/* 小设备（床边） */}
      <mesh position={[-2.6, 0.02, -0.5]}>
        <boxGeometry args={[0.08, 0.03, 0.12]} />
        <meshStandardMaterial color="#15152a" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}

// ========================
// 主组件 - 组装所有家具
// ========================

export default function Furniture() {
  return (
    <group>
      {/* 工作区（落地窗正前方偏右） */}
      <Desk />
      {/* 三显示器 - 弧形包围 */}
      <Monitor position={[0.5, 0.78, -2.2]} variant={0} rotY={0.12} />
      <Monitor position={[1.2, 0.78, -2.3]} variant={1} rotY={0} />
      <Monitor position={[1.9, 0.78, -2.2]} variant={2} rotY={-0.12} />
      <Keyboard />
      <Mouse />
      <DeskClutter />

      {/* 椅子 */}
      <Chair />

      {/* 睡眠区（左侧） */}
      <Bed />
      <Nightstand />
      <NeonPoster />
      <LivingClutter />

      {/* 存储/服务器区（右侧） */}
      <Bookshelf />
      <ServerRack />

      {/* 线缆 */}
      <Cables />

      {/* 小物件 */}
      <CoffeeMug />
      <GlowPlant />
      <RobotPet />

      {/* 标识 */}
      <NeonSign />
    </group>
  );
}
