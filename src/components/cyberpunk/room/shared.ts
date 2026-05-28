export const ROOM = { width: 7.2, depth: 7.3, height: 4.85 } as const;
// 视窗坐标统一放在这里，确保窗框、窗景和外部光源始终对齐
export const WINDOW = { width: 3.9, height: 3.35, bottomY: 0.34, centerX: -1.18, panels: 3 } as const;
export const WALL_COLOR = '#0d0d1a';
export const FLOOR_COLOR = '#121218';
