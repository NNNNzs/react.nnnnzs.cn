'use client';

import * as THREE from 'three';
import type { HomepageSceneVariant } from '../theme';

export function createCityTexture(variant: HomepageSceneVariant): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 白天和夜晚共用同一个生成入口，但内部画法分别对应完全不同的氛围
  if (variant === 'day') {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 560);
    skyGrad.addColorStop(0, '#c7e9ff');
    skyGrad.addColorStop(0.45, '#e7f5ff');
    skyGrad.addColorStop(1, '#fff7ed');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    for (let i = 0; i < 18; i++) {
      const cx = 120 + i * 110 + (i % 3) * 18;
      const cy = 90 + (i % 4) * 24;
      const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      cloud.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
      cloud.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = cloud;
      ctx.fillRect(cx - 120, cy - 70, 240, 140);
    }

    for (let i = 0; i < 54; i++) {
      const x = i * 42 - 80;
      const w = 20 + (i % 5) * 7;
      const h = 110 + (i % 9) * 23;
      const topY = 560 - h;
      const grad = ctx.createLinearGradient(x, topY, x, 560);
      grad.addColorStop(0, '#cbd5e1');
      grad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.35 + (i % 4) * 0.06;
      ctx.fillRect(x, topY, w, h);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      for (let wy = topY + 10; wy < 548; wy += 18) {
        for (let wx = x + 5; wx < x + w - 4; wx += 12) {
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
    ctx.globalAlpha = 1;

    const groundGrad = ctx.createLinearGradient(0, 560, 0, 1024);
    groundGrad.addColorStop(0, '#dbeafe');
    groundGrad.addColorStop(0.5, '#eff6ff');
    groundGrad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 560, 2048, 464);

    const sun = ctx.createRadialGradient(1720, 130, 0, 1720, 130, 420);
    sun.addColorStop(0, 'rgba(255, 236, 179, 0.85)');
    sun.addColorStop(0.42, 'rgba(255, 236, 179, 0.24)');
    sun.addColorStop(1, 'rgba(255, 236, 179, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(1250, -260, 900, 800);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0, '#020210');
  skyGrad.addColorStop(0.3, '#050518');
  skyGrad.addColorStop(0.6, '#0a0a28');
  skyGrad.addColorStop(1, '#10103a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 2048, 1024);

  const buildings: Array<{ x: number; w: number; h: number }> = [];
  for (let i = 0; i < 85; i++) {
    const x = i * 26 + Math.random() * 8 - 100;
    const w = 12 + Math.random() * 25;
    const h = 80 + Math.random() * 350;
    buildings.push({ x, w, h });
  }

  buildings.forEach((b) => {
    const topY = 512 - b.h;
    if (topY > 512) return;
    const grad = ctx.createLinearGradient(b.x, topY, b.x, 512);
    grad.addColorStop(0, '#080815');
    grad.addColorStop(0.5, '#0c0c1e');
    grad.addColorStop(1, '#121228');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, topY, b.w, Math.min(b.h, 512));

    if (topY > 100) {
      const topGlow = ctx.createRadialGradient(
        b.x + b.w / 2, topY, 0,
        b.x + b.w / 2, topY, b.w * 0.3,
      );
      topGlow.addColorStop(0, 'rgba(0, 200, 255, 0.03)');
      topGlow.addColorStop(1, 'rgba(0, 200, 255, 0)');
      ctx.fillStyle = topGlow;
      ctx.fillRect(b.x - 10, topY - 5, b.w + 20, 10);
    }

    for (let wy = topY + 4; wy < 500; wy += 6) {
      for (let wx = b.x + 2; wx < b.x + b.w - 2; wx += 5) {
        if (Math.random() > 0.35) {
          const colors = [
            '#00f0ff', '#ff0066', '#00ff88', '#ffaa00', '#ffffff',
            '#8844ff', '#00aaff', '#ff4488', '#44ffaa',
          ];
          const color = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.08 + Math.random() * 0.35;
          ctx.fillRect(wx, wy, 2.5, 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  });

  const neonSigns = [
    { x: 200, y: 280, w: 80, h: 30, color: '#ff0066', glow: '#ff006640' },
    { x: 450, y: 320, w: 60, h: 50, color: '#00f0ff', glow: '#00f0ff30' },
    { x: 800, y: 250, w: 100, h: 35, color: '#ff0066', glow: '#ff006640' },
    { x: 1000, y: 300, w: 70, h: 25, color: '#00ff88', glow: '#00ff8830' },
    { x: 1300, y: 270, w: 90, h: 40, color: '#ffaa00', glow: '#ffaa0030' },
    { x: 1600, y: 310, w: 75, h: 30, color: '#00f0ff', glow: '#00f0ff40' },
    { x: 1800, y: 260, w: 85, h: 35, color: '#ff0066', glow: '#ff006630' },
    { x: 350, y: 350, w: 50, h: 60, color: '#8844ff', glow: '#8844ff30' },
    { x: 1100, y: 340, w: 65, h: 45, color: '#00f0ff', glow: '#00f0ff35' },
    { x: 1500, y: 350, w: 55, h: 35, color: '#ff4488', glow: '#ff448830' },
  ];

  neonSigns.forEach((sign) => {
    const radGrad = ctx.createRadialGradient(
      sign.x + sign.w / 2, sign.y + sign.h / 2, 0,
      sign.x + sign.w / 2, sign.y + sign.h / 2, Math.max(sign.w, sign.h) * 1.5,
    );
    radGrad.addColorStop(0, sign.glow);
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.fillRect(sign.x - sign.w, sign.y - sign.h, sign.w * 3, sign.h * 3);

    ctx.fillStyle = sign.color;
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    ctx.fillRect(sign.x, sign.y, sign.w, sign.h);

    ctx.fillStyle = sign.color;
    ctx.globalAlpha = 0.3;
    for (let ly = sign.y + 6; ly < sign.y + sign.h - 4; ly += 7) {
      const lw = sign.w * (0.3 + Math.random() * 0.5);
      const lx = sign.x + (sign.w - lw) * Math.random();
      ctx.fillRect(lx, ly, lw, 2);
    }
    ctx.globalAlpha = 1;
  });

  for (let i = 0; i < 12; i++) {
    const cx = 100 + Math.random() * 1800;
    const cy = 180 + Math.random() * 250;
    const r = 40 + Math.random() * 80;
    const neonColors = ['#00f0ff', '#ff0066', '#00ff88', '#8844ff', '#ffaa00'];
    const color = neonColors[Math.floor(Math.random() * neonColors.length)];
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    radGrad.addColorStop(0, color + '25');
    radGrad.addColorStop(0.5, color + '10');
    radGrad.addColorStop(1, color + '00');
    ctx.fillStyle = radGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  for (let i = 0; i < 5; i++) {
    const y = 250 + Math.random() * 200;
    const startX = Math.random() * 400;
    const length = 200 + Math.random() * 800;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 200, 255, 0.15)' : 'rgba(255, 0, 102, 0.1)';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + length, y + (Math.random() - 0.5) * 20);
    ctx.stroke();

    const vx = startX + Math.random() * length;
    const vehicleGrad = ctx.createRadialGradient(vx, y, 0, vx, y, 8);
    vehicleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    vehicleGrad.addColorStop(0.3, 'rgba(0, 240, 255, 0.3)');
    vehicleGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = vehicleGrad;
    ctx.fillRect(vx - 10, y - 10, 20, 20);
  }

  for (let layer = 0; layer < 4; layer++) {
    const fogY = 350 + layer * 40;
    const fogGrad = ctx.createLinearGradient(0, fogY - 30, 0, fogY + 60);
    fogGrad.addColorStop(0, 'rgba(10, 10, 40, 0)');
    fogGrad.addColorStop(0.5, `rgba(15, 10, 35, ${0.05 + layer * 0.02})`);
    fogGrad.addColorStop(1, 'rgba(10, 10, 40, 0)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, fogY - 30, 2048, 90);
  }

  const groundGrad = ctx.createLinearGradient(0, 512, 0, 1024);
  groundGrad.addColorStop(0, '#10103a');
  groundGrad.addColorStop(0.15, '#0a0a25');
  groundGrad.addColorStop(0.4, '#060618');
  groundGrad.addColorStop(1, '#030310');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 512, 2048, 512);

  for (let i = 0; i < 15; i++) {
    const cx = Math.random() * 2048;
    const cy = 550 + Math.random() * 400;
    const r = 30 + Math.random() * 60;
    const neonColors = ['#00f0ff', '#ff0066', '#8844ff'];
    const color = neonColors[Math.floor(Math.random() * neonColors.length)];
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    radGrad.addColorStop(0, color + '15');
    radGrad.addColorStop(1, color + '00');
    ctx.fillStyle = radGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createFloorTexture(variant: HomepageSceneVariant): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 地面要兼顾“空间底板”和“前景延伸”，不能只是一张纯色板
  ctx.fillStyle = variant === 'day' ? '#7a5f3d' : '#0e0e16';
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 64) {
    ctx.strokeStyle = variant === 'day' ? '#5e472d' : '#080810';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const ly = y + 5 + Math.random() * 55;
      ctx.strokeStyle = variant === 'day'
        ? `rgba(255, 231, 186, ${0.08 + Math.random() * 0.14})`
        : `rgba(20, 20, 35, ${0.3 + Math.random() * 0.4})`;
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(512, ly + (Math.random() - 0.5) * 3);
      ctx.stroke();
    }
  }

  for (let x = 0; x < 512; x += 128) {
    ctx.strokeStyle = variant === 'day' ? '#5e472d' : '#080810';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 30;
    const radGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const color = Math.random() > 0.5 ? '0, 180, 255' : '100, 50, 150';
    radGrad.addColorStop(0, `rgba(${color}, 0.04)`);
    radGrad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = radGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (let i = 0; i < 10; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.strokeStyle = 'rgba(30, 25, 40, 0.2)';
    ctx.lineWidth = 2 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + Math.random() * 40, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4);
  return texture;
}

// ─── 墙面纹理系统 ───────────────────────────────────────────

type SeededRNG = () => number;

function createSeededRandom(seed: number): SeededRNG {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface WallContext {
  seed: number;
  neonLights: Array<{ x: number; y: number; radius: number; color: string; alpha: number }>;
  waterStainPositions: Array<{ x: number; y: number }>;
  pipeShadowYs: number[];
}

const WALL_SEEDS = { back: 42, left: 137, right: 256 } as const;

function buildWallContexts(variant: HomepageSceneVariant): Record<string, WallContext> {
  return {
    back: {
      seed: WALL_SEEDS.back,
      neonLights: [
        // 窗户映射光（窗中心 x=-1.18, 宽3.9 → 后墙约 30%-70%）
        { x: 512, y: 180, radius: 200, color: variant === 'day' ? '255,230,180' : '0,100,180', alpha: variant === 'day' ? 0.03 : 0.04 },
      ],
      waterStainPositions: [
        { x: 400, y: 420 },  // 窗台下方
        { x: 620, y: 450 },
      ],
      pipeShadowYs: [15, 35],
    },
    left: {
      seed: WALL_SEEDS.left,
      neonLights: [
        // 显示器蓝光（monitors y≈1.22, 在墙面高度约25%处）
        { x: 180, y: 130, radius: 100, color: '0,200,255', alpha: 0.035 },
        // 天花灯带映射
        { x: 500, y: 25, radius: 150, color: '0,240,255', alpha: 0.02 },
      ],
      waterStainPositions: [
        { x: 300, y: 460 },
      ],
      pipeShadowYs: [12, 28, 48],
    },
    right: {
      seed: WALL_SEEDS.right,
      neonLights: [
        // 服务器 LED 映射（serverRack y≈0-1.85, 中心约 40%）
        { x: 700, y: 200, radius: 80, color: '0,200,255', alpha: 0.03 },
        // 霓虹灯牌映射（neonSign y≈2.45, 在墙面约50%处）
        { x: 500, y: 256, radius: 120, color: '255,0,102', alpha: 0.025 },
      ],
      waterStainPositions: [
        { x: 200, y: 480 },
        { x: 600, y: 440 },
      ],
      pipeShadowYs: [18, 40],
    },
  };
}

// Layer 1: 混凝土大色块差异
function drawConcretePatches(ctx: CanvasRenderingContext2D, rng: SeededRNG, variant: HomepageSceneVariant) {
  for (let i = 0; i < 10; i++) {
    const cx = rng() * 1024;
    const cy = rng() * 512;
    const r = 80 + rng() * 120;
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    if (variant === 'day') {
      radGrad.addColorStop(0, `rgba(${210 + rng() * 25}, ${218 + rng() * 20}, ${228 + rng() * 15}, 0.12)`);
      radGrad.addColorStop(1, `rgba(${210 + rng() * 25}, ${218 + rng() * 20}, ${228 + rng() * 15}, 0)`);
    } else {
      radGrad.addColorStop(0, `rgba(${10 + rng() * 12}, ${10 + rng() * 12}, ${18 + rng() * 16}, 0.15)`);
      radGrad.addColorStop(1, `rgba(${10 + rng() * 12}, ${10 + rng() * 12}, ${18 + rng() * 16}, 0)`);
    }
    ctx.fillStyle = radGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

// Layer 2: 混凝土骨料颗粒
function drawConcreteAggregate(ctx: CanvasRenderingContext2D, rng: SeededRNG, variant: HomepageSceneVariant) {
  for (let i = 0; i < 20000; i++) {
    const x = rng() * 1024;
    const y = rng() * 512;
    if (variant === 'day') {
      ctx.fillStyle = `rgba(${195 + rng() * 30}, ${205 + rng() * 25}, ${218 + rng() * 20}, ${0.12 + rng() * 0.18})`;
    } else {
      ctx.fillStyle = `rgba(${12 + rng() * 18}, ${12 + rng() * 18}, ${22 + rng() * 18}, ${0.15 + rng() * 0.2})`;
    }
    const size = 1 + rng() * 2;
    ctx.fillRect(x, y, size, size);
  }
}

// Layer 3: 裂缝网络
function drawCrackNetwork(ctx: CanvasRenderingContext2D, rng: SeededRNG, variant: HomepageSceneVariant) {
  const crackColor = variant === 'day' ? 'rgba(160,155,148,0.35)' : 'rgba(28,28,45,0.4)';
  const shadowColor = variant === 'day' ? 'rgba(140,138,132,0.15)' : 'rgba(5,5,12,0.25)';

  // 主裂缝
  const mainCrackCount = 2 + Math.floor(rng() * 3);
  for (let c = 0; c < mainCrackCount; c++) {
    const startX = rng() * 1024;
    const startY = rng() * 512;
    const angle = (rng() - 0.5) * 0.6 + (rng() > 0.5 ? 0 : Math.PI);
    let cx = startX;
    let cy = startY;
    const segCount = 8 + Math.floor(rng() * 15);
    const segLen = 30 + rng() * 60;

    ctx.strokeStyle = crackColor;
    ctx.lineWidth = 0.8 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);

    for (let s = 0; s < segCount; s++) {
      const da = (rng() - 0.5) * 0.8;
      cx += Math.cos(angle + da) * segLen;
      cy += Math.sin(angle + da) * segLen;
      ctx.lineTo(cx, cy);

      // 裂缝阴影
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = crackColor;
      ctx.lineWidth = 0.8 + rng() * 1.2;
      ctx.stroke();

      // 分叉
      if (rng() > 0.65) {
        const branchAngle = angle + (rng() > 0.5 ? 1 : -1) * (0.5 + rng() * 1.2);
        const branchLen = 30 + rng() * 90;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(branchAngle) * branchLen, cy + Math.sin(branchAngle) * branchLen);
        ctx.strokeStyle = crackColor;
        ctx.lineWidth = 0.3 + rng() * 0.7;
        ctx.stroke();
      }
    }
    ctx.stroke();
  }

  // 微裂缝
  for (let i = 0; i < 12; i++) {
    const x = rng() * 1024;
    const y = rng() * 512;
    const angle = rng() * Math.PI * 2;
    const len = 20 + rng() * 100;
    ctx.strokeStyle = crackColor;
    ctx.lineWidth = 0.3 + rng() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
}

// Layer 4: 水渍痕迹
function drawWaterStains(ctx: CanvasRenderingContext2D, rng: SeededRNG, positions: Array<{ x: number; y: number }>, variant: HomepageSceneVariant) {
  const color = variant === 'day' ? 'rgba(180,195,210,0.12)' : 'rgba(18,20,30,0.18)';
  for (const pos of positions) {
    const w = 20 + rng() * 40;
    const h = 40 + rng() * 80;
    const radGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y + h / 2, h);
    radGrad.addColorStop(0, color);
    radGrad.addColorStop(0.6, color.replace(/[\d.]+\)$/, `${parseFloat(color.match(/[\d.]+\)$/)?.[0] || '0') * 0.5})`));
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.fillRect(pos.x - w, pos.y - h / 2, w * 2, h * 1.5);

    // 流水线条
    for (let l = 0; l < 4; l++) {
      const lx = pos.x + (rng() - 0.5) * w * 1.5;
      const ly = pos.y;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      for (let s = 0; s < 6; s++) {
        ctx.lineTo(lx + (rng() - 0.5) * 4, ly + s * (h / 6));
      }
      ctx.stroke();
    }
  }
}

// Layer 5: 墙皮剥落
function drawPeelingAreas(ctx: CanvasRenderingContext2D, rng: SeededRNG, variant: HomepageSceneVariant) {
  const count = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const cx = rng() * 1024;
    const cy = rng() * 512;
    const size = 25 + rng() * 55;
    const vertices = 5 + Math.floor(rng() * 4);
    const color = variant === 'day' ? 'rgba(200,192,182,0.2)' : 'rgba(20,18,25,0.25)';
    const edgeColor = variant === 'day' ? 'rgba(210,205,195,0.15)' : 'rgba(35,30,45,0.2)';

    // 不规则多边形剥落区
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let v = 0; v < vertices; v++) {
      const angle = (v / vertices) * Math.PI * 2;
      const r = size * (0.6 + rng() * 0.4);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (v === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // 翘起的边缘高光
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// Layer 6: 管道阴影
function drawPipeShadows(ctx: CanvasRenderingContext2D, rng: SeededRNG, ys: number[], variant: HomepageSceneVariant) {
  for (const y of ys) {
    const w = 150 + rng() * 250;
    const x = rng() * (1024 - w);
    const h = 6 + rng() * 10;
    const color = variant === 'day' ? 'rgba(170,175,185,0.1)' : 'rgba(5,5,12,0.2)';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    // 螺栓痕迹
    const boltCount = 2 + Math.floor(rng() * 3);
    for (let b = 0; b < boltCount; b++) {
      const bx = x + (b + 1) * (w / (boltCount + 1));
      const by = y + h / 2;
      ctx.fillStyle = variant === 'day' ? 'rgba(150,148,142,0.15)' : 'rgba(25,25,40,0.25)';
      ctx.beginPath();
      ctx.arc(bx, by, 3 + rng() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Layer 7: 霓虹映射光晕
function drawNeonMapping(ctx: CanvasRenderingContext2D, variant: HomepageSceneVariant, lights: WallContext['neonLights']) {
  for (const light of lights) {
    const radGrad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
    radGrad.addColorStop(0, `rgba(${light.color},${light.alpha})`);
    radGrad.addColorStop(0.5, `rgba(${light.color},${light.alpha * 0.4})`);
    radGrad.addColorStop(1, `rgba(${light.color},0)`);
    ctx.fillStyle = radGrad;
    ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
  }
}

// ─── RoughnessMap 绘制 ─────────────────────────────────────

function drawBrickPattern(ctx: CanvasRenderingContext2D, rng: SeededRNG) {
  const brickW = 50;
  const brickH = 25;
  const gap = 2;

  for (let row = 0; row * (brickH + gap) < 256; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col * (brickW + gap) < 512 + brickW; col++) {
      const bx = col * (brickW + gap) + offset;
      const by = row * (brickH + gap);
      // 砖缝（低 roughness = 暗色）
      ctx.fillStyle = `rgb(${Math.floor(140 + rng() * 10)},${Math.floor(140 + rng() * 10)},${Math.floor(140 + rng() * 10)})`;
      ctx.fillRect(bx, by, brickW + gap, brickH + gap);
      // 砖面（高 roughness = 亮色）
      const roughVal = 217 + Math.floor(rng() * 12);
      ctx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
      ctx.fillRect(bx + gap, by + gap, brickW - gap, brickH - gap);
    }
  }
}

function drawRoughnessCracks(ctx: CanvasRenderingContext2D, rng: SeededRNG) {
  const crackCount = 2 + Math.floor(rng() * 2);
  for (let c = 0; c < crackCount; c++) {
    const startX = rng() * 512;
    const startY = rng() * 256;
    const angle = rng() * Math.PI;
    let cx = startX, cy = startY;
    ctx.strokeStyle = `rgb(${Math.floor(153 + rng() * 25)},${Math.floor(153 + rng() * 25)},${Math.floor(153 + rng() * 25)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 10; s++) {
      cx += Math.cos(angle + (rng() - 0.5) * 0.8) * 30;
      cy += Math.sin(angle + (rng() - 0.5) * 0.8) * 30;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
}

// ─── 组合：单面墙纹理 ──────────────────────────────────────

interface WallTextures {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

function createSingleWallTextures(variant: HomepageSceneVariant, wallCtx: WallContext): WallTextures {
  const rng = createSeededRandom(wallCtx.seed);

  // ColorMap: 1024 x 512
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 1024;
  colorCanvas.height = 512;
  const colorCtx = colorCanvas.getContext('2d')!;

  colorCtx.fillStyle = variant === 'day' ? '#dfe7ef' : '#0d0d1a';
  colorCtx.fillRect(0, 0, 1024, 512);

  drawConcretePatches(colorCtx, rng, variant);
  drawConcreteAggregate(colorCtx, rng, variant);
  drawCrackNetwork(colorCtx, rng, variant);
  drawWaterStains(colorCtx, rng, wallCtx.waterStainPositions, variant);
  drawPeelingAreas(colorCtx, rng, variant);
  drawPipeShadows(colorCtx, rng, wallCtx.pipeShadowYs, variant);
  drawNeonMapping(colorCtx, variant, wallCtx.neonLights);

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.wrapS = THREE.ClampToEdgeWrapping;
  colorTexture.wrapT = THREE.ClampToEdgeWrapping;

  // RoughnessMap: 512 x 256
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 256;
  const roughCtx = roughCanvas.getContext('2d')!;

  // 基础 roughness 0.88 → 灰度 224
  roughCtx.fillStyle = 'rgb(224,224,224)';
  roughCtx.fillRect(0, 0, 512, 256);

  // 天花板附近：更高 roughness（灰尘）
  const ceilGrad = roughCtx.createLinearGradient(0, 0, 0, 30);
  ceilGrad.addColorStop(0, 'rgb(242,242,242)');
  ceilGrad.addColorStop(1, 'rgb(224,224,224)');
  roughCtx.fillStyle = ceilGrad;
  roughCtx.fillRect(0, 0, 512, 30);

  // 下部墙裙：更高 roughness（磨损）
  const baseGrad = roughCtx.createLinearGradient(0, 220, 0, 256);
  baseGrad.addColorStop(0, 'rgb(224,224,224)');
  baseGrad.addColorStop(1, 'rgb(240,240,240)');
  roughCtx.fillStyle = baseGrad;
  roughCtx.fillRect(0, 220, 512, 36);

  drawBrickPattern(roughCtx, rng);
  drawRoughnessCracks(roughCtx, rng);

  const roughTexture = new THREE.CanvasTexture(roughCanvas);
  roughTexture.wrapS = THREE.ClampToEdgeWrapping;
  roughTexture.wrapT = THREE.ClampToEdgeWrapping;

  return { color: colorTexture, roughness: roughTexture };
}

export interface WallTexturesSet {
  back: WallTextures;
  left: WallTextures;
  right: WallTextures;
}

export function createWallTextures(variant: HomepageSceneVariant): WallTexturesSet {
  const contexts = buildWallContexts(variant);
  return {
    back: createSingleWallTextures(variant, contexts.back),
    left: createSingleWallTextures(variant, contexts.left),
    right: createSingleWallTextures(variant, contexts.right),
  };
}
