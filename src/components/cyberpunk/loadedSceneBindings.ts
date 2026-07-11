import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Post } from '@/types';
import { createDataScreenTexture } from './furniture/shared';
import type { CommitEntry, DeployRecord, ScreenTextureData } from './furniture/types';
import type { HomepageSceneVariant } from './theme';

export interface SceneActivityData {
  commits: CommitEntry[];
  deployHistory: DeployRecord[];
}

export function useSceneActivityData(): SceneActivityData {
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [deployHistory, setDeployHistory] = useState<DeployRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchJson = async <T,>(url: string): Promise<T[]> => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return [];
        const payload = await response.json() as { status?: boolean; data?: T[] };
        return payload.status && Array.isArray(payload.data) ? payload.data : [];
      } catch {
        return [];
      }
    };

    const refreshDeploys = async () => {
      const data = await fetchJson<DeployRecord>('/api/deploy/history');
      if (!cancelled) setDeployHistory(data);
    };
    const refreshCommits = async () => {
      const data = await fetchJson<CommitEntry>('/api/activity/commits?limit=8');
      if (!cancelled) setCommits(data);
    };

    void Promise.all([refreshDeploys(), refreshCommits()]);
    const deployTimer = window.setInterval(refreshDeploys, 30_000);
    const commitTimer = window.setInterval(refreshCommits, 300_000);

    return () => {
      cancelled = true;
      window.clearInterval(deployTimer);
      window.clearInterval(commitTimer);
    };
  }, []);

  return { commits, deployHistory };
}

export function useMonitorScreenData(
  posts: Post[],
  commits: CommitEntry[],
  deployHistory: DeployRecord[],
): [ScreenTextureData, ScreenTextureData, ScreenTextureData] {
  return useMemo(() => {
    const latestDeploy = deployHistory[0];
    return [
      {
        variant: 'commit-log',
        headerColor: '#6dffb4',
        headerText: 'COMMITS',
        lines: commits.length > 0
          ? commits.slice(0, 8).map((commit, index) => ({
              text: `${commit.hash}  ${commit.message.length > 40 ? `${commit.message.slice(0, 40)}...` : commit.message}`,
              color: index === 0 ? '#6dffb4' : '#a0c4e8',
              highlight: index === 0,
            }))
          : [{ text: 'Waiting for commit activity', color: '#667788' }],
      },
      {
        variant: 'deploy-status',
        headerColor: '#00f0ff',
        headerText: 'DEPLOY STATUS',
        lines: latestDeploy
          ? [
              { text: `Status: ${latestDeploy.status.toUpperCase()}`, color: latestDeploy.status === 'success' ? '#00f0ff' : latestDeploy.status === 'failure' ? '#ff2a9a' : '#ffb347', highlight: true },
              { text: `Commit: ${latestDeploy.commit}`, color: '#a0c4e8' },
              { text: `Version: ${latestDeploy.version}`, color: '#a0c4e8' },
              { text: `Updated: ${latestDeploy.timestamp}`, color: '#667788' },
            ]
          : [{ text: 'Waiting for deploy activity', color: '#667788' }],
      },
      {
        variant: 'post-feed',
        headerColor: '#ff2a9a',
        headerText: 'RECENT POSTS',
        lines: posts.length > 0
          ? posts.slice(0, 8).map((post, index) => ({
              text: `${post.date?.slice(0, 10) ?? ''}  ${post.title ?? ''}`,
              color: index === 0 ? '#ff2a9a' : '#a0c4e8',
              highlight: index === 0,
            }))
          : [{ text: 'No post data', color: '#667788' }],
      },
    ];
  }, [commits, deployHistory, posts]);
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const characters = Array.from(text);
  let line = '';
  let lineIndex = 0;
  for (const character of characters) {
    const candidate = line + character;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      line = character;
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
    } else {
      line = candidate;
    }
  }
  if (line && lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}

function createArticleTerminalTexture(posts: Post[], index: number, variant: HomepageSceneVariant): THREE.CanvasTexture {
  const post = posts[index];
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  context.fillStyle = variant === 'day' ? '#e8f6fb' : '#041018';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#28e5ff';
  context.lineWidth = 6;
  context.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
  context.fillStyle = '#28e5ff';
  context.font = '24px monospace';
  context.fillText('ARTICLE TERMINAL', 52, 78);
  context.fillStyle = '#ff4dad';
  context.fillText(`${String(index + 1).padStart(2, '0')} / ${String(Math.max(posts.length, 1)).padStart(2, '0')}`, 520, 78);
  context.fillStyle = '#89a8bb';
  context.font = '22px monospace';
  context.fillText(post?.date?.slice(0, 10) ?? 'ARCHIVE STANDBY', 52, 142);

  const title = post?.title ?? '等待文章数据';
  context.fillStyle = variant === 'day' ? '#122b3a' : '#f4fbff';
  context.font = 'bold 42px sans-serif';
  drawWrappedText(context, title, 52, 230, 610, 64, 4);

  context.fillStyle = variant === 'day' ? '#405d6c' : '#8da6b5';
  context.font = '24px sans-serif';
  drawWrappedText(context, post?.description ?? '记录技术、工具、运维、AI 与生活里的长期思考。', 52, 500, 610, 38, 4);

  context.strokeStyle = variant === 'day' ? '#7cc9de' : '#176477';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(52, 680);
  context.lineTo(668, 680);
  context.stroke();
  context.font = '18px monospace';
  posts.slice(0, 4).forEach((item, itemIndex) => {
    context.fillStyle = itemIndex === index ? '#ff4dad' : variant === 'day' ? '#31596b' : '#6f98ab';
    const fullTitle = item.title ?? 'Untitled';
    const itemTitle = fullTitle.length > 28 ? `${fullTitle.slice(0, 28)}…` : fullTitle;
    context.fillText(`${String(itemIndex + 1).padStart(2, '0')}  ${itemTitle}`, 52, 724 + itemIndex * 30);
  });

  context.fillStyle = '#8da6b5';
  context.font = '18px sans-serif';
  context.fillText('点击屏幕进入当前文章', 52, 858);
  context.fillStyle = '#28e5ff';
  context.fillRect(52, 874, 420, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function tuneScreenTexture(texture: THREE.CanvasTexture): THREE.CanvasTexture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createSceneContentTextures(
  screenData: [ScreenTextureData, ScreenTextureData, ScreenTextureData],
  posts: Post[],
  articleIndex: number,
  variant: HomepageSceneVariant,
): Record<string, THREE.CanvasTexture> {
  const names = ['monitor_left_screen', 'monitor_center_screen', 'monitor_right_screen'] as const;
  const textures: Record<string, THREE.CanvasTexture> = {};
  names.forEach((name, index) => {
    textures[name] = tuneScreenTexture(createDataScreenTexture(screenData[index]));
  });
  textures.article_terminal_screen = tuneScreenTexture(
    createArticleTerminalTexture(posts, articleIndex, variant),
  );
  return textures;
}

export function bindTexturesToScene(
  scene: THREE.Object3D,
  textures: Record<string, THREE.CanvasTexture>,
): () => void {
  const restorers: Array<() => void> = [];
  const staticScreenDecorations: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (/^monitor_(left|center|right)_ui_line_/.test(object.name) || /^article_terminal_ui_/.test(object.name)) {
      if (object.visible) staticScreenDecorations.push(object);
      object.visible = false;
    }
  });
  restorers.push(() => staticScreenDecorations.forEach((object) => { object.visible = true; }));

  Object.entries(textures).forEach(([name, texture]) => {
    const object = scene.getObjectByName(name);
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    if (!bounds) return;
    const size = bounds.getSize(new THREE.Vector3());
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(size.x * 0.94, size.y * 0.92);
    const overlay = new THREE.Mesh(geometry, material);
    overlay.name = `${name}_runtime_content`;
    overlay.position.set(0, 0, bounds.max.z + Math.max(size.z * 0.08, 0.002));
    overlay.renderOrder = 2;
    object.add(overlay);
    restorers.push(() => {
      object.remove(overlay);
      geometry.dispose();
      material.dispose();
    });
  });

  return () => restorers.forEach((restore) => restore());
}
