'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';
import type { Post } from '@/types';
import { ImageOptimizationType, optimizeImageUrl } from '@/lib/image';

const ARTICLE_TERMINAL_POST_LIMIT = 5;
const CAROUSEL_INTERVAL_MS = 5200;
const TEXTURE_WIDTH = 720;
const TEXTURE_HEIGHT = 900;

const formatPostDate = (date?: string | null) => {
  if (!date) return 'UNDATED';
  return date.slice(0, 10);
};

const getCanvasSafeCoverUrl = (cover?: string | null) => {
  const optimizedCover = optimizeImageUrl(cover, ImageOptimizationType.POST_CARD_COVER);
  if (!optimizedCover) return '';

  if (optimizedCover.startsWith('http://') || optimizedCover.startsWith('https://')) {
    return `/api/fs/proxy-image?url=${encodeURIComponent(optimizedCover)}`;
  }

  return optimizedCover;
};

const drawWrappedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) => {
  const chars = Array.from(text);
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (const char of chars) {
    const testLine = `${line}${char}`;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lineCount += 1;
      if (lineCount >= maxLines) {
        ctx.fillText(`${line.slice(0, Math.max(0, line.length - 2))}...`, x, currentY);
        return;
      }
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) ctx.fillText(line, x, currentY);
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

const drawCoverPlaceholder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
) => {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
  gradient.addColorStop(0.55, 'rgba(255, 42, 154, 0.18)');
  gradient.addColorStop(1, 'rgba(5, 6, 17, 0.82)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.38;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + 38 + i * 42, y + height);
    ctx.lineTo(x + 126 + i * 36, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const drawArticleTerminalCanvas = ({
  ctx,
  variant,
  posts,
  activeIndex,
  coverImage,
}: {
  ctx: CanvasRenderingContext2D;
  variant: 'day' | 'night';
  posts: Post[];
  activeIndex: number;
  coverImage?: HTMLImageElement;
}) => {
  const post = posts[activeIndex];
  const isDay = variant === 'day';
  const accent = isDay ? '#0ea5e9' : '#00f0ff';
  const hotAccent = isDay ? '#f472b6' : '#ff2a9a';
  const text = isDay ? '#083344' : '#e6fbff';
  const muted = isDay ? 'rgba(8, 47, 73, 0.62)' : 'rgba(198, 244, 255, 0.68)';
  const panel = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  panel.addColorStop(0, isDay ? 'rgba(241, 250, 255, 0.9)' : 'rgba(9, 19, 32, 0.82)');
  panel.addColorStop(0.5, isDay ? 'rgba(224, 242, 254, 0.76)' : 'rgba(10, 18, 38, 0.72)');
  panel.addColorStop(1, isDay ? 'rgba(186, 230, 253, 0.64)' : 'rgba(5, 6, 17, 0.78)');

  ctx.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.72;
  ctx.strokeRect(18, 18, TEXTURE_WIDTH - 36, TEXTURE_HEIGHT - 36);
  ctx.globalAlpha = 1;

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.18;
  for (let y = 76; y < TEXTURE_HEIGHT - 40; y += 46) {
    ctx.fillRect(28, y, TEXTURE_WIDTH - 56, 2);
  }
  ctx.globalAlpha = 1;

  ctx.font = '36px monospace';
  ctx.fillStyle = muted;
  ctx.letterSpacing = '0px';
  ctx.fillText('ARTICLE STREAM', 58, 86);

  ctx.font = '30px monospace';
  ctx.fillStyle = hotAccent;
  ctx.textAlign = 'right';
  ctx.fillText(`${String(activeIndex + 1).padStart(2, '0')} / ${String(Math.max(posts.length, 1)).padStart(2, '0')}`, TEXTURE_WIDTH - 58, 86);
  ctx.textAlign = 'left';

  const coverX = 58;
  const coverY = 126;
  const coverWidth = TEXTURE_WIDTH - 116;
  const coverHeight = 270;
  if (coverImage && coverImage.complete && coverImage.naturalWidth > 0) {
    drawImageCover(ctx, coverImage, coverX, coverY, coverWidth, coverHeight);
  } else {
    drawCoverPlaceholder(ctx, coverX, coverY, coverWidth, coverHeight, accent);
  }

  const coverFade = ctx.createLinearGradient(coverX, coverY, coverX, coverY + coverHeight);
  coverFade.addColorStop(0, 'rgba(5, 6, 17, 0)');
  coverFade.addColorStop(1, 'rgba(5, 6, 17, 0.42)');
  ctx.fillStyle = coverFade;
  ctx.fillRect(coverX, coverY, coverWidth, coverHeight);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.74;
  ctx.strokeRect(coverX, coverY, coverWidth, coverHeight);
  ctx.globalAlpha = 1;

  ctx.font = '24px monospace';
  ctx.fillStyle = accent;
  ctx.fillText(formatPostDate(post?.date), coverX + 18, coverY + coverHeight - 24);

  ctx.font = 'bold 38px monospace';
  ctx.fillStyle = text;
  drawWrappedText(ctx, post?.title || 'AWAITING ARTICLE SYNC', 58, 462, TEXTURE_WIDTH - 116, 52, 3);

  ctx.font = '24px monospace';
  ctx.fillStyle = muted;
  drawWrappedText(ctx, post?.description || 'Recent post feed is linked to this article terminal.', 58, 622, TEXTURE_WIDTH - 116, 36, 3);

  const railY = 758;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(58, railY - 32, TEXTURE_WIDTH - 116, 120);
  ctx.globalAlpha = 1;

  ctx.font = '20px monospace';
  posts.slice(0, 4).forEach((item, index) => {
    const y = railY + index * 28;
    ctx.fillStyle = index === activeIndex ? hotAccent : accent;
    ctx.fillText(String(index + 1).padStart(2, '0'), 80, y);
    ctx.fillStyle = index === activeIndex ? text : muted;
    drawWrappedText(ctx, item.title || 'Untitled', 132, y, TEXTURE_WIDTH - 196, 24, 1);
  });

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  const dotGap = 28;
  const startX = TEXTURE_WIDTH / 2 - ((posts.length - 1) * dotGap) / 2;
  posts.forEach((_, index) => {
    ctx.beginPath();
    ctx.arc(startX + index * dotGap, TEXTURE_HEIGHT - 52, index === activeIndex ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
};

function useArticleTerminalTexture({
  variant,
  posts,
  activeIndex,
}: {
  variant: 'day' | 'night';
  posts: Post[];
  activeIndex: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_WIDTH;
    canvas.height = TEXTURE_HEIGHT;
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 4;
    return nextTexture;
  }, []);

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    const activePost = posts[activeIndex];
    const draw = (coverImage?: HTMLImageElement) => {
      drawArticleTerminalCanvas({ ctx, variant, posts, activeIndex, coverImage });
      texture.needsUpdate = true;
    };

    draw();

    const cover = getCanvasSafeCoverUrl(activePost?.cover);
    if (!cover) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!cancelled) draw(image);
    };
    image.onerror = () => {
      if (!cancelled) draw();
    };
    image.src = cover;

    return () => {
      cancelled = true;
    };
  }, [activeIndex, posts, texture, variant]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
};

function ArticleTerminalCore({ variant, posts }: { variant: 'day' | 'night'; posts?: Post[] }) {
  const ref = useRef<THREE.Group>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const color = variant === 'day' ? '#0ea5e9' : '#ff2a9a';
  const activePosts = useMemo(() => (posts ?? []).slice(0, ARTICLE_TERMINAL_POST_LIMIT), [posts]);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = activePosts.length > 0 ? activeIndex % activePosts.length : 0;
  const activePost = activePosts[safeActiveIndex];
  const articleTexture = useArticleTerminalTexture({
    variant,
    posts: activePosts.length > 0 ? activePosts : [],
    activeIndex: safeActiveIndex,
  });

  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    if (activePosts.length <= 1) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % activePosts.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [activePosts.length]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (!ref.current) return;
    ref.current.position.y = 0.9 + Math.sin(elapsed * 1.1) * 0.045;
    ref.current.rotation.y = Math.sin(elapsed * 0.3) * 0.08;

    if (screenRef.current) {
      const material = screenRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.74 + Math.sin(elapsed * 1.4) * 0.08;
    }
  });

  return (
    <group ref={ref} position={[0, 0.9, 0]}>
      <mesh position={[0, 0.17, 0.001]}>
        <boxGeometry args={[1.03, 1.26, 0.035]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.16} toneMapped={false} />
      </mesh>
      <mesh
        ref={screenRef}
        position={[0, 0.17, 0.026]}
        onClick={(event) => {
          event.stopPropagation();
          if (activePost?.path) window.location.href = activePost.path;
        }}
        onPointerOver={() => {
          if (activePost?.path) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <planeGeometry args={[0.96, 1.18]} />
        <meshStandardMaterial
          map={articleTexture}
          emissive={color}
          emissiveMap={articleTexture}
          emissiveIntensity={0.74}
          transparent
          opacity={variant === 'day' ? 0.78 : 0.68}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <NeonStrip position={[0, 0.79, 0.04]} scale={[1.08, 0.01, 0.01]} color="#00f0ff" intensity={0.95} />
      <NeonStrip position={[0, -0.45, 0.04]} scale={[1.08, 0.01, 0.01]} color={color} intensity={0.95} />
      <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.39, 36]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.75} transparent opacity={0.45} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CoffeeTableCluster({ variant, posts }: { variant: 'day' | 'night'; posts?: Post[] }) {
  const table = FURNITURE_LAYOUT.coffeeTable;

  return (
    <group position={table.position}>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[table.bounds.width, 0.08, table.bounds.depth]} />
        <meshStandardMaterial color="#101018" metalness={0.5} roughness={0.28} transparent opacity={0.78} />
      </mesh>
      {[
        [-0.75, 0.18, -0.32],
        [0.75, 0.18, -0.32],
        [-0.75, 0.18, 0.32],
        [0.75, 0.18, 0.32],
      ].map((pos, index) => (
        <mesh key={index} position={pos as [number, number, number]}>
          <boxGeometry args={[0.05, 0.36, 0.05]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      <ArticleTerminalCore variant={variant} posts={posts} />
      <mesh position={[-0.55, 0.45, 0.2]}>
        <cylinderGeometry args={[0.04, 0.035, 0.16, 14]} />
        <meshStandardMaterial color="#181827" roughness={0.7} />
      </mesh>
      <mesh position={[0.6, 0.48, -0.12]}>
        <cylinderGeometry args={[0.035, 0.032, 0.22, 12]} />
        <meshStandardMaterial color="#231026" emissive="#ff2a9a" emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

function SofaCluster() {
  const sofa = FURNITURE_LAYOUT.sofa;

  return (
    <group position={sofa.position} rotation={sofa.rotation}>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[sofa.bounds.width, 0.46, sofa.bounds.depth]} />
        <meshStandardMaterial color="#11111b" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.78, -0.28]}>
        <boxGeometry args={[sofa.bounds.width, 0.7, 0.18]} />
        <meshStandardMaterial color="#0d0d16" roughness={0.9} />
      </mesh>
      {[-0.68, 0, 0.68].map((x) => (
        <mesh key={x} position={[x, 0.65, 0.02]} rotation={[0.05, 0, 0]}>
          <boxGeometry args={[0.55, 0.16, 0.45]} />
          <meshStandardMaterial color="#151521" roughness={0.96} />
        </mesh>
      ))}
      <NeonStrip position={[0, 0.16, 0.37]} scale={[2.18, 0.035, 0.03]} color="#ff2a9a" intensity={1.2} />
    </group>
  );
}

export default function LivingCoreZone({ variant, posts = [] }: { variant: 'day' | 'night'; posts?: Post[] }) {
  const [livingX, , livingZ] = FURNITURE_LAYOUT.coffeeTable.position;

  return (
    <EditableGroup id="living-core-zone">
      <mesh position={[livingX, 0.012, livingZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.55]} />
        <meshStandardMaterial color="#111122" roughness={0.86} metalness={0.12} />
      </mesh>
      <NeonStrip position={[livingX, 0.03, livingZ - 0.75]} scale={[2.6, 0.018, 0.018]} color="#00d8ff" intensity={0.42} />
      <NeonStrip position={[livingX, 0.03, livingZ + 0.75]} scale={[2.6, 0.018, 0.018]} color="#ff2a9a" intensity={0.42} />
      <CoffeeTableCluster variant={variant} posts={posts} />
      <SofaCluster />
    </EditableGroup>
  );
}
