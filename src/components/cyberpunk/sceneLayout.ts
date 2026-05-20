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
  size: { width: 6, depth: 8, height: 3.8 },
  // 后墙落地窗，bottomY 是窗户下边缘离地高度。
  window: { width: 4.5, height: 3.5, bottomY: 0.1 },
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
    { position: [clampCenteredX(-0.9, 3.8), 3.65, -2] as Vec3, length: clampCeilingSpan(3.8), radius: 0.06, axis: 'x' },
    { position: [clampCenteredX(0.65, 4.2), 3.7, 0.5] as Vec3, length: clampCeilingSpan(4.2), radius: 0.05, axis: 'x' },
    { position: [clampCenteredX(0, 5.55), 3.6, -3] as Vec3, length: clampCeilingSpan(5.55), radius: 0.07, axis: 'x' },
    { position: [clampCenteredX(-0.5, 3.5), 3.72, 1] as Vec3, length: clampCeilingSpan(3.5), radius: 0.04, axis: 'x' },
    { position: [clampCenteredX(0.55, 4.35), 3.68, -1] as Vec3, length: clampCeilingSpan(4.35), radius: 0.05, axis: 'x' },
  ],
  // 天花板纵深管道：axis='z' 表示沿房间深度方向摆放。
  depthPipes: [
    { position: [-2, 3.65, -1.5] as Vec3, length: 3, radius: 0.04, axis: 'z' },
    { position: [2, 3.7, 0] as Vec3, length: 4, radius: 0.05, axis: 'z' },
    { position: [-1, 3.72, 1] as Vec3, length: 2.5, radius: 0.035, axis: 'z' },
  ],
  // 电缆桥架：作为整体长条盒子配置，不拆成左右边框。
  cableTrays: [
    { position: [clampCenteredX(-0.55, 4.7), 3.73, -0.5] as Vec3, bounds: { width: clampCeilingSpan(4.7), height: 0.02, depth: 0.15 } },
    { position: [clampCenteredX(0.75, 4.1), 3.74, -2.5] as Vec3, bounds: { width: clampCeilingSpan(4.1), height: 0.02, depth: 0.15 } },
  ],
  // 天花板灯带：style 决定白天/夜晚颜色和发光强度，尺寸按整体灯带配置。
  ceilingLightBars: [
    { position: [clampCenteredX(-0.9, 3.8), 3.6, -2] as Vec3, bounds: { width: clampCeilingSpan(3.8), height: 0.015, depth: 0.015 }, style: 'warm-cyan' },
    { position: [clampCenteredX(0.65, 4.2), 3.65, 0.5] as Vec3, bounds: { width: clampCeilingSpan(4.2), height: 0.015, depth: 0.015 }, style: 'cool-purple' },
    { position: [clampCenteredX(0, 5.55), 3.55, -3] as Vec3, bounds: { width: clampCeilingSpan(5.55), height: 0.015, depth: 0.015 }, style: 'alert-pink' },
  ],
} as const;

export const FURNITURE_LAYOUT = {
  // 工作桌整体：桌板、桌腿、横撑都以这个 group 为局部坐标原点。
  desk: {
    position: [1.2, 0, -2] as Vec3,
    bounds: { width: 2.2, height: 0.79, depth: 0.85 },
    style: 'industrial dark wood workstation',
  },
  // 三联显示器：每台作为一个整体屏幕单元，variant 只控制屏幕纹理。
  monitors: [
    { position: [0.5, 0.78, -2.2] as Vec3, rotation: [0, 0.12, 0] as Euler3, bounds: { width: 0.62, height: 0.58, depth: 0.12 }, variant: 0 },
    { position: [1.2, 0.78, -2.3] as Vec3, rotation: [0, 0, 0] as Euler3, bounds: { width: 0.62, height: 0.58, depth: 0.12 }, variant: 1 },
    { position: [1.9, 0.78, -2.2] as Vec3, rotation: [0, -0.12, 0] as Euler3, bounds: { width: 0.62, height: 0.58, depth: 0.12 }, variant: 2 },
  ],
  // 桌面小物件：整体坐标配置在这里，按桌面高度放置。
  keyboard: { position: [1.2, 0.78, -1.7] as Vec3, rotation: [-0.08, 0, 0] as Euler3, bounds: { width: 0.55, height: 0.03, depth: 0.2 } },
  mouse: { position: [1.55, 0.78, -1.65] as Vec3, bounds: { width: 0.06, height: 0.025, depth: 0.1 } },
  // 椅子整体：座垫、靠背、外套和底座都跟随这个位置移动。
  chair: { position: [1.2, 0, -0.8] as Vec3, bounds: { width: 0.55, height: 1.1, depth: 0.7 }, style: 'office chair with jacket' },
  // 睡眠区：床整体靠左，bounds 覆盖床架、床垫、被子、床头板。
  bed: { position: [-2, 0, -1.5] as Vec3, bounds: { width: 1.3, height: 0.65, depth: 2 }, style: 'messy single bed' },
  nightstand: { position: [-1.1, 0, -2.3] as Vec3, bounds: { width: 0.35, height: 0.58, depth: 0.3 } },
  // 左墙海报：position 靠近 x=-3，rotation 让它贴到左墙面。
  neonPoster: { position: [-2.97, 1.8, -1.5] as Vec3, rotation: [0, Math.PI / 2, 0] as Euler3, bounds: { width: 0.85, height: 0.55, depth: 0.02 } },
  // 右侧储物区。rotation 后，书架正面朝向房间内部。
  bookshelf: { position: [2.5, 0, -1.5] as Vec3, rotation: [0, -Math.PI / 2, 0] as Euler3, bounds: { width: 0.84, height: 3.2, depth: 0.35 }, style: 'tall right-wall storage shelf' },
  serverRack: { position: [2.8, 0, -3] as Vec3, bounds: { width: 0.5, height: 1.8, depth: 0.42 }, style: 'right-wall server rack' },
  // 小装饰物：作为整体摆件配置，内部发光/叶片/几何造型不在布局层展开。
  coffeeMug: { position: [2.0, 0.78, -1.85] as Vec3, bounds: { width: 0.08, height: 0.08, depth: 0.08 } },
  glowPlant: { position: [-2.5, 0, -3.2] as Vec3, bounds: { width: 0.4, height: 0.5, depth: 0.4 } },
  robotPet: { position: [1.8, 0, -1.2] as Vec3, rotation: [0, -0.5, 0] as Euler3, bounds: { width: 0.25, height: 0.3, depth: 0.36 } },
  // 悬浮内容终端：动画只在 Y 轴围绕 position[1] 轻微浮动。
  hologramPanels: { position: [-0.72, 1.55, -2.72] as Vec3, rotation: [0, 0.12, 0] as Euler3, bounds: { width: 1.1, height: 1.05, depth: 0.08 } },
  // 窗口上方招牌：整体包含背板、文字、边框和光晕。
  neonSign: { position: [0, 3.55, -3.95] as Vec3, bounds: { width: 2.5, height: 1, depth: 0.04 }, style: 'window header sign' },
} as const;
