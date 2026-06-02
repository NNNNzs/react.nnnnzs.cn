'use client';

export type Vec3 = [number, number, number];
export type Euler3 = [number, number, number];

export interface Bounds3 {
  width: number;
  height: number;
  depth: number;
}

export interface PlacedObject {
  // 整体物件的世界坐标。家具内部的板材、枕头、屏幕等仍使用相对坐标。
  position: Vec3;
  // 整体物件的朝向。只在需要贴墙、斜放、面向视角时配置。
  rotation?: Euler3;
  // 整体物件外包尺寸，用来检查是否越过房间边界，不代表内部每块板的尺寸。
  bounds: Bounds3;
  // 风格标签。渲染层可按标签选择颜色、发光强度或材质。
  style?: string;
}

// 房间基础尺寸：宽 X、深 Z、高 Y。所有家具和屋顶装饰都以这组尺寸作为边界。
export const ROOM_LAYOUT = {
  size: { width: 7.2, depth: 7.3, height: 4.85 },
  // 后墙落地窗，bottomY 是窗户下边缘离地高度。
  window: { width: 3.9, height: 3.35, bottomY: 0.34, centerX: -1.18, panels: 3 },
} as const;

const roomHalfWidth = ROOM_LAYOUT.size.width / 2;
// 天花装饰离左右墙的安全缩进，避免灯带或管道贴边/穿墙。
const ceilingInset = 0.22;
const maxCeilingSpan = ROOM_LAYOUT.size.width - ceilingInset * 2;

// 常用房间边界。改房间尺寸后，这里会自动同步。
export const ROOM_BOUNDS = {
  left: -roomHalfWidth,
  right: roomHalfWidth,
  back: -ROOM_LAYOUT.size.depth / 2,
  front: ROOM_LAYOUT.size.depth / 2,
  floor: 0,
  ceiling: ROOM_LAYOUT.size.height,
  maxCeilingSpan,
} as const;

// 限制天花板横向装饰的最大长度，防止长度超过左右墙之间的可用跨度。
const clampCeilingSpan = (length: number) => Math.min(length, maxCeilingSpan);

// 给横向装饰重新计算 X 中心点：
// 例如一根 4.2m 的灯带放在 x=1.5 会穿出右墙，这里会自动把它往中间收。
const clampCenteredX = (x: number, width: number) => {
  const half = width / 2;
  return Math.max(ROOM_BOUNDS.left + half + ceilingInset, Math.min(ROOM_BOUNDS.right - half - ceilingInset, x));
};

export const ROOM_OBJECTS = {
  // 天花板横向管道：axis='x' 表示实际沿房间宽度方向摆放。
  // length 是整根管道长度，radius 是圆柱半径。
  ceilingPipes: [
    { position: [clampCenteredX(-0.8, 3.15), 4.3, -2.25] as Vec3, length: clampCeilingSpan(3.15), radius: 0.06, axis: 'x' },
    { position: [clampCenteredX(0.35, 3.45), 4.36, 0.2] as Vec3, length: clampCeilingSpan(3.45), radius: 0.05, axis: 'x' },
    { position: [clampCenteredX(-0.1, 4.55), 4.26, -2.95] as Vec3, length: clampCeilingSpan(4.55), radius: 0.07, axis: 'x' },
    { position: [clampCenteredX(-0.55, 2.95), 4.38, 0.95] as Vec3, length: clampCeilingSpan(2.95), radius: 0.04, axis: 'x' },
    { position: [clampCenteredX(0.7, 3.55), 4.34, -1.05] as Vec3, length: clampCeilingSpan(3.55), radius: 0.05, axis: 'x' },
  ],
  // 天花板纵深管道：axis='z' 表示沿房间深度方向摆放。
  depthPipes: [
    { position: [-1.75, 4.3, -1.45] as Vec3, length: 3.0, radius: 0.04, axis: 'z' },
    { position: [1.55, 4.36, -0.05] as Vec3, length: 3.55, radius: 0.05, axis: 'z' },
    { position: [-0.65, 4.38, 0.95] as Vec3, length: 2.45, radius: 0.035, axis: 'z' },
  ],
  // 电缆桥架：作为整体长条盒子配置，不拆成左右边框。
  cableTrays: [
    { position: [clampCenteredX(-0.35, 3.75), 4.4, -0.45] as Vec3, bounds: { width: clampCeilingSpan(3.75), height: 0.02, depth: 0.15 } },
    { position: [clampCenteredX(0.35, 3.25), 4.41, -2.55] as Vec3, bounds: { width: clampCeilingSpan(3.25), height: 0.02, depth: 0.15 } },
  ],
  // 天花板灯带：style 决定白天/夜晚颜色和发光强度，尺寸按整体灯带配置。
  ceilingLightBars: [
    { position: [clampCenteredX(-0.8, 3.15), 4.24, -2.25] as Vec3, bounds: { width: clampCeilingSpan(3.15), height: 0.015, depth: 0.015 }, style: 'warm-cyan' },
    { position: [clampCenteredX(0.35, 3.45), 4.3, 0.2] as Vec3, bounds: { width: clampCeilingSpan(3.45), height: 0.015, depth: 0.015 }, style: 'cool-purple' },
    { position: [clampCenteredX(-0.1, 4.55), 4.2, -2.95] as Vec3, bounds: { width: clampCeilingSpan(4.55), height: 0.015, depth: 0.015 }, style: 'alert-pink' },
    { position: [clampCenteredX(-0.55, 2.95), 4.32, 0.95] as Vec3, bounds: { width: clampCeilingSpan(2.95), height: 0.015, depth: 0.015 }, style: 'warm-cyan' },
    { position: [clampCenteredX(0.7, 3.55), 4.28, -1.05] as Vec3, bounds: { width: clampCeilingSpan(3.55), height: 0.015, depth: 0.015 }, style: 'cool-purple' },
  ],
} as const;

export const FURNITURE_LAYOUT = {
  // 左侧窗前工作区：长桌、三联屏、电竞椅。
  desk: {
    position: [-2.16, 0, -2.08] as Vec3,
    bounds: { width: 2.78, height: 0.82, depth: 0.86 },
    style: 'left window triple monitor workstation',
  },
  // 三联显示器：朝向默认相机，略微弧形包围。
  monitors: [
    { position: [-2.98, 1.22, -2.34] as Vec3, rotation: [0, 0.23, 0] as Euler3, bounds: { width: 0.8, height: 0.6, depth: 0.12 }, variant: 0 },
    { position: [-2.16, 1.24, -2.48] as Vec3, rotation: [0, 0, 0] as Euler3, bounds: { width: 0.8, height: 0.64, depth: 0.12 }, variant: 1 },
    { position: [-1.34, 1.22, -2.34] as Vec3, rotation: [0, -0.23, 0] as Euler3, bounds: { width: 0.8, height: 0.6, depth: 0.12 }, variant: 2 },
  ],
  keyboard: { position: [-2.16, 0.84, -1.78] as Vec3, rotation: [-0.08, 0, 0] as Euler3, bounds: { width: 0.68, height: 0.03, depth: 0.23 } },
  mouse: { position: [-1.54, 0.84, -1.73] as Vec3, bounds: { width: 0.08, height: 0.025, depth: 0.12 } },
  chair: { position: [-2.1, 0, -0.96] as Vec3, rotation: [0, Math.PI, 0] as Euler3, bounds: { width: 0.66, height: 1.22, depth: 0.8 }, style: 'gaming chair facing triple monitors' },

  // 右侧睡眠区。
  bed: { position: [2.35, 0, 0.22] as Vec3, bounds: { width: 1.85, height: 0.72, depth: 1.24 }, style: 'low neon platform bed' },
  nightstand: { position: [3.02, 0, -0.48] as Vec3, bounds: { width: 0.42, height: 0.56, depth: 0.38 } },
  neonPoster: { position: [3.57, 1.74, 0.35] as Vec3, rotation: [0, -Math.PI / 2, 0] as Euler3, bounds: { width: 0.82, height: 0.62, depth: 0.02 } },

  // 东墙存储与设备区。窗子所在北墙只保留窗景。
  bookshelf: { position: [3.42, 0, -2.58] as Vec3, rotation: [0, -Math.PI / 2, 0] as Euler3, bounds: { width: 1.25, height: 2.55, depth: 0.4 }, style: 'east wall books and devices shelf' },
  serverRack: { position: [3.4, 0, -1.42] as Vec3, rotation: [0, -Math.PI / 2, 0] as Euler3, bounds: { width: 0.58, height: 1.85, depth: 0.46 }, style: 'east wall server rack' },

  // 中央客厅核心区。
  coffeeTable: { position: [-0.08, 0, 0.72] as Vec3, bounds: { width: 1.42, height: 0.4, depth: 0.74 }, style: 'hologram coffee table' },
  sofa: { position: [-0.1, 0, 2.42] as Vec3, rotation: [0, Math.PI, 0] as Euler3, bounds: { width: 2.3, height: 0.86, depth: 0.68 }, style: 'foreground leather sofa' },
  wardrobe: { position: [3.4, 0, 1.72] as Vec3, rotation: [0, -Math.PI / 2, 0] as Euler3, bounds: { width: 1.1, height: 2.25, depth: 0.48 }, style: 'east wall open neon wardrobe' },

  // 小装饰物：作为整体摆件配置，内部发光/叶片/几何造型不在布局层展开。
  coffeeMug: { position: [-1.18, 0.84, -1.96] as Vec3, bounds: { width: 0.08, height: 0.08, depth: 0.08 } },
  glowPlant: { position: [-3.32, 0, -1.34] as Vec3, bounds: { width: 0.42, height: 0.72, depth: 0.42 } },
  robotPet: { position: [-2.28, 0, 2.62] as Vec3, rotation: [0, -0.2, 0] as Euler3, bounds: { width: 0.3, height: 0.2, depth: 0.34 } },
  // 悬浮内容终端：动画只在 Y 轴围绕 position[1] 轻微浮动。
  hologramPanels: { position: [-0.08, 1.0, 0.72] as Vec3, rotation: [0, -0.08, 0] as Euler3, bounds: { width: 0.95, height: 1.0, depth: 0.08 } },
  // 窗口上方招牌：整体包含背板、文字、边框和光晕。
  neonSign: { position: [-3.56, 2.45, -1.75] as Vec3, rotation: [0, Math.PI / 2, 0] as Euler3, bounds: { width: 1.7, height: 0.68, depth: 0.04 }, style: 'west wall neon sign' },
} as const;
