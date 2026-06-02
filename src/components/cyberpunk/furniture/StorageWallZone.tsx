'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BlinkingLED, NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';
import type { BookshelfCollection, DeployRecord } from './types';
import type { HomepageSceneVariant } from '../theme';
import { ImageOptimizationType, optimizeImageUrl } from '@/lib/image';

const SHELF_YS = [0.35, 0.82, 1.29, 1.76, 2.23, 2.7];
const DEFAULT_CORE_COLORS = ['#00f0ff', '#ff2a9a', '#7b61ff', '#6dffb4', '#ffd166', '#00f0ff'];
const BOOK_COLUMNS = 6;
const BOOK_WIDTH = 0.13;
const BOOK_GAP = 0.035;
const BOOK_DEPTH = 0.26;
const BOOK_START_X = -((BOOK_COLUMNS - 1) * (BOOK_WIDTH + BOOK_GAP)) / 2;
const COLLECTION_BOOK_LIMIT = 24;

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url);
}

function getCollectionMediaUrl(cover?: string | null, background?: string | null): string {
  const mediaUrl = background && isVideoUrl(background)
    ? background
    : cover || background || '';

  if (!mediaUrl || isVideoUrl(mediaUrl)) return mediaUrl;
  return optimizeImageUrl(mediaUrl, ImageOptimizationType.SMALL_THUMBNAIL);
}

function getBookSlot(index: number) {
  const row = Math.floor(index / BOOK_COLUMNS);
  const col = index % BOOK_COLUMNS;
  const shelfY = SHELF_YS[row % SHELF_YS.length];
  const height = 0.3 + ((index * 5) % 7) * 0.016;

  return {
    x: BOOK_START_X + col * (BOOK_WIDTH + BOOK_GAP),
    y: shelfY + 0.05 + height / 2,
    height,
  };
}

function createCollectionBookTexture(title: string, articleCount: number, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 384, 512);

  gradient.addColorStop(0, '#09131f');
  gradient.addColorStop(0.45, color);
  gradient.addColorStop(1, '#050611');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 384, 512);

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = '#ffffff';
  for (let y = 28; y < 512; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(384, y - 48);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.strokeStyle = `${color}cc`;
  ctx.lineWidth = 10;
  ctx.strokeRect(22, 22, 340, 468);

  ctx.fillStyle = '#f4fdff';
  ctx.font = 'bold 34px sans-serif';
  wrapCanvasText(ctx, title, 46, 118, 290, 42, 4);

  ctx.fillStyle = '#c8f8ff';
  ctx.font = '24px monospace';
  ctx.fillText(`${articleCount} POSTS`, 46, 408);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const chars = Array.from(text);
  let line = '';
  let lineCount = 0;

  for (const char of chars) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = testLine;
    }
  }

  if (line) ctx.fillText(line, x, y);
}

function useCollectionCoverTexture(collection: BookshelfCollection, color: string) {
  const mediaUrl = getCollectionMediaUrl(collection.cover, collection.background);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    const setFallback = () => {
      queueMicrotask(() => {
        const fallback = createCollectionBookTexture(collection.title, collection.articleCount, color);
        if (cancelled) {
          fallback.dispose();
          return;
        }
        setTexture(fallback);
        cleanup = () => fallback.dispose();
      });
    };

    if (!mediaUrl) {
      setFallback();
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    if (isVideoUrl(mediaUrl)) {
      const video = document.createElement('video');
      video.src = mediaUrl;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;

      const handleReady = () => {
        if (!cancelled) setTexture(videoTexture);
      };

      video.addEventListener('loadeddata', handleReady, { once: true });
      video.play().catch(() => undefined);
      cleanup = () => {
        video.removeEventListener('loadeddata', handleReady);
        video.pause();
        video.removeAttribute('src');
        video.load();
        videoTexture.dispose();
      };

      return () => {
        cancelled = true;
        cleanup();
      };
    }

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      mediaUrl,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        setTexture(loadedTexture);
        cleanup = () => loadedTexture.dispose();
      },
      undefined,
      setFallback,
    );

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [collection.articleCount, collection.title, color, mediaUrl]);

  return texture;
}

function CollectionBookUnit({
  collection,
  index,
  isExpanded,
  onToggle,
}: {
  collection: BookshelfCollection;
  index: number;
  isExpanded: boolean;
  onToggle: (id: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color = collection.color || DEFAULT_CORE_COLORS[index % DEFAULT_CORE_COLORS.length];
  const { x, y, height } = getBookSlot(index);
  const targetZ = hovered || isExpanded ? 0.72 : 0.48;
  const coverTexture = useCollectionCoverTexture(collection, color);
  const mediaUrl = getCollectionMediaUrl(collection.cover, collection.background);
  const shortTitle = collection.title.length > 9 ? `${collection.title.slice(0, 8)}…` : collection.title;
  const cardYOffset = THREE.MathUtils.clamp(1.34 - y, height / 2 + 0.3, 0.84);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, targetZ, 0.11);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, isExpanded ? -0.08 : 0, 0.08);

    const material = ref.current.children[1] instanceof THREE.Mesh
      ? ref.current.children[1].material
      : null;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissiveIntensity = (isExpanded || hovered ? 0.18 : 0.07) + Math.sin(clock.getElapsedTime() * 1.5 + index) * 0.03;
    }
  });

  return (
    <group
      position={[x, y, 0]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      onClick={(e) => { e.stopPropagation(); onToggle(collection.id); }}
    >
      <group ref={ref} position={[0, 0, 0.48]}>
        <mesh>
          <boxGeometry args={[BOOK_WIDTH, height, BOOK_DEPTH]} />
          <meshStandardMaterial
            color={hovered || isExpanded ? '#1e1e36' : '#141423'}
            metalness={0.2}
            roughness={0.68}
            emissive={color}
            emissiveIntensity={hovered || isExpanded ? 0.1 : 0.03}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, BOOK_DEPTH / 2 + 0.004]}>
          <boxGeometry args={[BOOK_WIDTH * 0.86, height * 0.94, 0.008]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.07} roughness={0.58} toneMapped={false} />
        </mesh>
        <Text
          position={[0, 0, BOOK_DEPTH / 2 + 0.012]}
          rotation={[0, 0, Math.PI / 2]}
          fontSize={0.035}
          maxWidth={height * 0.72}
          anchorX="center"
          anchorY="middle"
          color="#f7feff"
        >
          {shortTitle}
        </Text>
        <Text
          position={[BOOK_WIDTH / 2 + 0.004, 0, 0.02]}
          rotation={[0, Math.PI / 2, Math.PI / 2]}
          fontSize={0.025}
          maxWidth={height * 0.68}
          anchorX="center"
          anchorY="middle"
          color="#b9f7ff"
        >
          {shortTitle}
        </Text>
        <mesh position={[0, 0, BOOK_DEPTH / 2 + 0.018]} visible={isExpanded}>
          <planeGeometry args={[BOOK_WIDTH * 2.1, height * 0.98]} />
          <meshStandardMaterial
            color={coverTexture ? '#ffffff' : color}
            map={coverTexture ?? undefined}
            emissive={color}
            emissiveIntensity={0.12}
            roughness={0.42}
            toneMapped={false}
          />
        </mesh>
        <NeonStrip position={[0, -height / 2 - 0.014, 0.01]} scale={[BOOK_WIDTH * 0.9, 0.012, 0.018]} color={color} intensity={hovered || isExpanded ? 1.2 : 0.45} />
      </group>

      {isExpanded && (
        <Html center distanceFactor={6} zIndexRange={[30, 10]} position={[0.1, cardYOffset, 0.78]}>
          <div
            data-collection-book-card
            className="pointer-events-none w-36 overflow-hidden rounded border bg-[#050611]/92 text-[10px] leading-relaxed text-cyan-100 shadow-[0_0_22px_rgba(0,240,255,0.18)] backdrop-blur"
            style={{ borderColor: `${color}55` }}
          >
            <div className="aspect-[4/3] bg-[#0a1020]">
              {mediaUrl ? (
                isVideoUrl(mediaUrl) ? (
                  <video src={mediaUrl} className="h-full w-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full items-center justify-center px-3 text-center font-semibold" style={{ color }}>
                  {collection.title}
                </div>
              )}
            </div>
            <div className="px-2.5 py-2">
              <div className="truncate text-xs font-semibold text-cyan-50">{collection.title}</div>
              <div className="mt-0.5 flex items-center justify-between text-cyan-200/60">
                <span>{collection.articleCount} 篇文章</span>
                <a className="pointer-events-auto text-cyan-100 underline-offset-2 hover:underline" href={`/collections/${collection.slug}`}>进入</a>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Bookshelf({ collections, variant }: { collections?: BookshelfCollection[]; variant?: HomepageSceneVariant }) {
  const layout = FURNITURE_LAYOUT.bookshelf;
  const isDay = variant === 'day';
  const [expandedCollectionId, setExpandedCollectionId] = useState<number | null>(null);
  const bookInteractionRef = useRef(false);

  const handleToggle = (id: number) => {
    bookInteractionRef.current = true;
    setExpandedCollectionId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (expandedCollectionId === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-collection-book-card]')) return;
      window.setTimeout(() => {
        if (bookInteractionRef.current) {
          bookInteractionRef.current = false;
          return;
        }
        setExpandedCollectionId(null);
      }, 0);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [expandedCollectionId]);

  return (
    <EditableGroup id="bookshelf" position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, 0.08]} />
        <meshStandardMaterial color={isDay ? '#24202a' : '#0c0c15'} metalness={0.5} roughness={0.44} />
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
          <mesh key={index} position={[x, y + h / 2, 0.35]}>
            <boxGeometry args={[0.065, h, 0.16]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        );
      })}
      {collections && collections.length > 0
        ? collections.slice(0, COLLECTION_BOOK_LIMIT).map((col, i) => (
            <CollectionBookUnit
              key={col.id}
              collection={col}
              index={i}
              isExpanded={expandedCollectionId === col.id}
              onToggle={handleToggle}
            />
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
  isExpanded,
  onToggle,
}: {
  row: number;
  y: number;
  deployRecord?: DeployRecord;
  isExpanded: boolean;
  onToggle: (row: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const targetZ = hovered || isExpanded ? 0.45 : 0.26;

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
          color={hovered || isExpanded ? '#1e1e36' : '#151525'}
          metalness={0.7}
          roughness={0.3}
          emissive={isExpanded ? (statusColor ?? '#00f0ff') : '#000000'}
          emissiveIntensity={isExpanded ? 0.08 : (hovered ? 0.04 : 0)}
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
      {isExpanded && deployRecord && (
        <Html center distanceFactor={6} zIndexRange={[30, 10]} position={[0, 0.2, 0]}>
          <div
            data-server-unit-card
            className="pointer-events-none rounded border bg-[#050611]/92 px-3 py-2 backdrop-blur text-[10px] font-mono leading-relaxed whitespace-nowrap"
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

function ServerRack({ deployHistory, variant }: { deployHistory?: DeployRecord[]; variant?: HomepageSceneVariant }) {
  const layout = FURNITURE_LAYOUT.serverRack;
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const serverInteractionRef = useRef(false);
  const isDay = variant === 'day';

  const handleToggle = (row: number) => {
    serverInteractionRef.current = true;
    setExpandedRow((prev) => (prev === row ? null : row));
  };

  useEffect(() => {
    if (expandedRow === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-server-unit-card]')) return;
      window.setTimeout(() => {
        if (serverInteractionRef.current) {
          serverInteractionRef.current = false;
          return;
        }
        setExpandedRow(null);
      }, 0);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [expandedRow]);

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
          isExpanded={expandedRow === row}
          onToggle={handleToggle}
        />
      ))}
      <NeonStrip position={[0.35, 1.0, 0.03]} scale={[0.022, 1.75, 0.025]} color="#00d8ff" intensity={1.2} />
      <pointLight
        position={[0.08, 1.04, 0.24]}
        color={isDay ? '#a7d8ff' : '#00d8ff'}
        intensity={isDay ? 0.18 : 0.9}
        distance={isDay ? 1.8 : 2.8}
        decay={2}
      />
    </EditableGroup>
  );
}

export default function StorageWallZone({ collections, deployHistory, variant }: { collections?: BookshelfCollection[]; deployHistory?: DeployRecord[]; variant?: HomepageSceneVariant }) {
  return (
    <>
      <Bookshelf collections={collections} variant={variant} />
      <ServerRack deployHistory={deployHistory} variant={variant} />

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
