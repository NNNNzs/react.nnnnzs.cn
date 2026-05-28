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

export function createWallTexture(variant: HomepageSceneVariant): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // 墙面纹理只保留轻量噪点，避免压过窗景和家具的视觉重心
  ctx.fillStyle = variant === 'day' ? '#dfe7ef' : '#0d0d1a';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = variant === 'day'
      ? `rgba(${190 + Math.random() * 35}, ${202 + Math.random() * 35}, ${215 + Math.random() * 30}, 0.25)`
      : `rgba(${15 + Math.random() * 15}, ${15 + Math.random() * 15}, ${25 + Math.random() * 15}, 0.3)`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  for (let i = 0; i < 5; i++) {
    const cx = Math.random() * 256;
    const cy = Math.random() * 256;
    const r = 20 + Math.random() * 40;
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    radGrad.addColorStop(0, 'rgba(10, 10, 20, 0.3)');
    radGrad.addColorStop(1, 'rgba(10, 10, 20, 0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}
