'use client';

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { DownOutlined } from '@ant-design/icons';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { bannerCopy } from '@/config/site-copy/home';
import { selectStyleText } from '@/lib/site-style/copy';
import type { Post } from '@/types';
import type { BookshelfCollection } from './furniture/types';
import type { HomepageSceneVariant } from './theme';
import { HOMEPAGE_THEME_PRESETS } from './theme';
import RainEffect from './RainEffect';
import SceneLights from './SceneLights';
import WindowScene from './room/WindowScene';
import {
  bindTexturesToScene,
  createSceneContentTextures,
  useMonitorScreenData,
  useSceneActivityData,
} from './loadedSceneBindings';

// Version the URL so an already-mounted useGLTF cache cannot retain the old white-material export.
const MODEL_URL = '/models/cyberpunk-homepage-room.glb?v=2';
type FocusKey = 'default' | 'desk' | 'living' | 'bookshelf' | 'server' | 'sleep';

interface FocusPreset {
  key: FocusKey;
  label: string;
  rootName: string;
  position: [number, number, number];
  target: [number, number, number];
  marker: [number, number, number];
  fov: number;
}

const DEFAULT_FOCUS: FocusPreset = {
  key: 'default',
  label: '全景',
  rootName: 'room_root',
  position: [-2.85, 2.2, 2.9],
  target: [0.25, 1.02, -1.35],
  marker: [0, 1.45, 2.2],
  fov: 68,
};

const FOCUS_PRESETS: Record<Exclude<FocusKey, 'default'>, FocusPreset> = {
  desk: { key: 'desk', label: '工作区', rootName: 'desk_root', position: [-2.04, 1.55, -0.62], target: [-2.16, 1.24, -2.42], marker: [-1.85, 1.4, -1.9], fov: 36 },
  living: { key: 'living', label: '文章终端', rootName: 'article_terminal_root', position: [2.0, 2.0, 2.45], target: [-0.28, 0.86, 0.72], marker: [-0.28, 1.4, 0.72], fov: 42 },
  bookshelf: { key: 'bookshelf', label: '书架', rootName: 'bookshelf_root', position: [1.0, 1.9, -0.7], target: [3.3, 1.35, -2.52], marker: [3.15, 2.22, -2.52], fov: 42 },
  server: { key: 'server', label: '服务器', rootName: 'server_rack_root', position: [-2.25, 1.62, -0.64], target: [-0.42, 1.02, -2.04], marker: [-0.42, 1.68, -2.04], fov: 40 },
  sleep: { key: 'sleep', label: '睡眠区', rootName: 'bed_root', position: [-0.55, 1.75, 2.65], target: [2.56, 0.72, 0.66], marker: [2.56, 1.05, 0.66], fov: 44 },
};

const REQUIRED_CONTENT_NODES = [
  'monitor_left_screen',
  'monitor_center_screen',
  'monitor_right_screen',
  'article_terminal_screen',
] as const;

const DAY_MATERIAL_COLORS: Record<string, string> = {
  M_Wall_Matte: '#d9dde2',
  M_Wall_Panel: '#cbd1d9',
  M_Floor_DarkMetal: '#8b6845',
  M_Floor_Groove: '#6e5139',
  M_Floor_Inlay: '#a47a50',
  M_GraphiteMetal: '#3d424b',
  M_BlackMetal: '#181b22',
  M_DarkWood: '#c89b6a',
  M_Fabric_Charcoal: '#b9ad9d',
  M_Fabric_Secondary: '#d8cdbc',
  M_Bedding_Navy: '#d9c7b4',
  M_Bedding_Light: '#f5ede0',
  M_Ceramic: '#e3e0d8',
  M_Plant_Green: '#4f7657',
  M_Plant_Dark: '#335640',
};

const NIGHT_MATERIAL_COLORS: Record<string, string> = {
  M_Wall_Matte: '#171d29',
  M_Wall_Panel: '#202938',
  M_Floor_DarkMetal: '#1b2734',
  M_Floor_Groove: '#0d141d',
  M_Floor_Inlay: '#33485b',
  M_GraphiteMetal: '#303b49',
  M_BlackMetal: '#151d28',
  M_DarkWood: '#493238',
  M_Fabric_Charcoal: '#38404e',
  M_Fabric_Secondary: '#4a5262',
  M_Bedding_Navy: '#303c5d',
  M_Bedding_Light: '#a6a3b2',
  M_Ceramic: '#8e91a0',
  M_Plant_Green: '#245d42',
  M_Plant_Dark: '#143e31',
};

function applySceneVariantMaterials(scene: THREE.Object3D, variant: HomepageSceneVariant): () => void {
  const materials = new Set<THREE.MeshStandardMaterial>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) materials.add(material);
    });
  });

  const snapshots = Array.from(materials, (material) => ({
    material,
    color: material.color.clone(),
    emissive: material.emissive.clone(),
    emissiveIntensity: material.emissiveIntensity,
    metalness: material.metalness,
    roughness: material.roughness,
  }));

  snapshots.forEach(({ material }) => {
    const color = variant === 'day'
      ? DAY_MATERIAL_COLORS[material.name]
      : NIGHT_MATERIAL_COLORS[material.name];
    if (color) material.color.set(color);
    material.metalness *= variant === 'day' ? 0.48 : 0.72;
    material.roughness = Math.min(1, material.roughness + (variant === 'day' ? 0.12 : 0.06));
    if (material.name.startsWith('M_Emit_')) {
      material.emissiveIntensity *= variant === 'day' ? 0.22 : 0.38;
    }
    material.needsUpdate = true;
  });

  return () => snapshots.forEach((snapshot) => {
    snapshot.material.color.copy(snapshot.color);
    snapshot.material.emissive.copy(snapshot.emissive);
    snapshot.material.emissiveIntensity = snapshot.emissiveIntensity;
    snapshot.material.metalness = snapshot.metalness;
    snapshot.material.roughness = snapshot.roughness;
    snapshot.material.needsUpdate = true;
  });
}

class SceneErrorBoundary extends Component<{
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[LoadedSceneBanner] scene render failed', error, info.componentStack);
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function collectFocusPresets(scene: THREE.Object3D): Record<FocusKey, FocusPreset> {
  const presets = { default: DEFAULT_FOCUS } as Record<FocusKey, FocusPreset>;
  (Object.entries(FOCUS_PRESETS) as Array<[Exclude<FocusKey, 'default'>, FocusPreset]>).forEach(([key, preset]) => {
    if (scene.getObjectByName(preset.rootName)) presets[key] = preset;
  });
  return presets;
}

function SceneModel({
  variant,
  posts,
  collections,
  deployHistory,
  screenData,
  articleIndex,
  onFocusReady,
}: {
  variant: HomepageSceneVariant;
  posts: Post[];
  collections: BookshelfCollection[];
  deployHistory: ReturnType<typeof useSceneActivityData>['deployHistory'];
  screenData: ReturnType<typeof useMonitorScreenData>;
  articleIndex: number;
  onFocusReady: (presets: Record<FocusKey, FocusPreset>) => void;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const deployRecords = useMemo(() => deployHistory ?? [], [deployHistory]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const initialPositions = useRef(new Map<string, THREE.Vector3>());
  const textures = useMemo(
    () => createSceneContentTextures(screenData, posts, articleIndex, variant),
    [articleIndex, posts, screenData, variant],
  );

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.receiveShadow = true;
      if (/^(book_unit_|server_drawer_)/.test(object.name)) {
        initialPositions.current.set(object.name, object.position.clone());
      }
    });
    if (process.env.NODE_ENV === 'development') {
      const missingNodes = REQUIRED_CONTENT_NODES.filter((name) => !scene.getObjectByName(name));
      const missingRoots = Object.values(FOCUS_PRESETS).filter(({ rootName }) => !scene.getObjectByName(rootName));
      if (missingNodes.length > 0 || missingRoots.length > 0) {
        console.error('[LoadedSceneBanner] GLB node contract mismatch', {
          missingNodes,
          missingRoots: missingRoots.map(({ rootName }) => rootName),
        });
      }
    }
    onFocusReady(collectFocusPresets(scene));
  }, [onFocusReady, scene]);

  useEffect(() => {
    const hiddenArchitecture: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (object.name === 'north_wall' || object.name === 'east_wall' || object.name.startsWith('north_wall_panel_trim_') || object.name.startsWith('east_wall_panel_trim_')) {
        if (object.visible) hiddenArchitecture.push(object);
        object.visible = false;
      }
    });
    return () => hiddenArchitecture.forEach((object) => { object.visible = true; });
  }, [scene]);

  useEffect(() => applySceneVariantMaterials(scene, variant), [scene, variant]);

  useEffect(() => {
    const restorers: Array<() => void> = [];
    for (let row = 1; row <= 8; row += 1) {
      const record = deployRecords.at(row - 1);
      const color = record?.status === 'failure' ? '#ff2a9a' : record?.status === 'deploying' ? '#ffb347' : '#00f0ff';
      for (let led = 1; led <= 2; led += 1) {
        const object = scene.getObjectByName(`server_led_${String(row).padStart(2, '0')}_${String(led).padStart(2, '0')}`);
        if (!(object instanceof THREE.Mesh)) continue;
        const originalMaterial = object.material;
        const source = Array.isArray(originalMaterial) ? originalMaterial.at(0) : originalMaterial;
        const material = source instanceof THREE.MeshStandardMaterial ? source.clone() : new THREE.MeshStandardMaterial();
        material.color.set(color);
        material.emissive.set(color);
        material.emissiveIntensity = record?.status === 'deploying' ? 2.6 : 1.8;
        object.material = material;
        restorers.push(() => {
          object.material = originalMaterial;
          material.dispose();
        });
      }
    }
    return () => restorers.forEach((restore) => restore());
  }, [deployRecords, scene, variant]);

  useEffect(() => {
    const restore = bindTexturesToScene(scene, textures);
    return () => {
      restore();
      Object.values(textures).forEach((texture) => texture.dispose());
    };
  }, [scene, textures]);

  useFrame(({ clock }) => {
    initialPositions.current.forEach((initial, name) => {
      const object = scene.getObjectByName(name);
      if (!object) return;
      const active = hoveredNode === name || selectedBook === name || selectedServer === name;
      if (name.startsWith('book_unit_')) {
        object.position.x = THREE.MathUtils.lerp(object.position.x, initial.x + (active ? -0.22 : 0), 0.12);
        object.rotation.y = THREE.MathUtils.lerp(object.rotation.y, selectedBook === name ? -0.08 : 0, 0.1);
      } else {
        object.position.z = THREE.MathUtils.lerp(object.position.z, initial.z + (active ? 0.2 : 0), 0.12);
      }
    });

    for (let row = 1; row <= 8; row += 1) {
      if (deployRecords.at(row - 1)?.status !== 'deploying') continue;
      for (let led = 1; led <= 2; led += 1) {
        const object = scene.getObjectByName(`server_led_${String(row).padStart(2, '0')}_${String(led).padStart(2, '0')}`);
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) continue;
        object.material.emissiveIntensity = 1.8 + Math.sin(clock.elapsedTime * 4 + row) * 0.8;
      }
    }
  });

  const findInteractiveNode = useCallback((object: THREE.Object3D): string | null => {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (/^(book_unit_|server_drawer_)/.test(current.name)) return current.name;
      current = current.parent;
    }
    return null;
  }, []);

  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    const name = findInteractiveNode(event.object);
    if (!name) return;
    event.stopPropagation();
    setHoveredNode(name);
    document.body.style.cursor = 'pointer';
  }, [findInteractiveNode]);

  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    const name = findInteractiveNode(event.object);
    if (!name) return;
    setHoveredNode((current) => current === name ? null : current);
    document.body.style.cursor = 'default';
  }, [findInteractiveNode]);

  const activePostPath = posts[articleIndex]?.path;
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    const name = findInteractiveNode(event.object);
    if (name?.startsWith('book_unit_')) {
      event.stopPropagation();
      setSelectedServer(null);
      setSelectedBook((current) => current === name ? null : name);
      return;
    }
    if (name?.startsWith('server_drawer_')) {
      event.stopPropagation();
      setSelectedBook(null);
      setSelectedServer((current) => current === name ? null : name);
      return;
    }
    const clickedScreenName = event.object.name.endsWith('_runtime_content')
      ? event.object.parent?.name
      : event.object.name;
    if (clickedScreenName === 'article_terminal_screen' && activePostPath) {
      event.stopPropagation();
      window.location.href = activePostPath;
      return;
    }
    setSelectedBook(null);
    setSelectedServer(null);
  }, [activePostPath, findInteractiveNode]);

  const selectedBookIndex = selectedBook ? Number(selectedBook.slice(-2)) - 1 : -1;
  const selectedCollection = selectedBookIndex >= 0 ? collections[selectedBookIndex] : undefined;
  const selectedBookPosition = selectedBook ? scene.getObjectByName(selectedBook)?.getWorldPosition(new THREE.Vector3()) : undefined;
  const selectedServerIndex = selectedServer ? Number(selectedServer.slice(-2)) - 1 : -1;
  const selectedDeploy = selectedServerIndex >= 0 ? deployRecords.at(selectedServerIndex) : undefined;
  const selectedServerPosition = selectedServer ? scene.getObjectByName(selectedServer)?.getWorldPosition(new THREE.Vector3()) : undefined;

  return (
    <>
      <primitive object={scene} onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} />
      {selectedCollection && selectedBookPosition ? (
        <Html position={[selectedBookPosition.x - 0.3, selectedBookPosition.y + 0.55, selectedBookPosition.z]} center distanceFactor={6} zIndexRange={[40, 20]}>
          <div data-collection-book-card className="w-44 overflow-hidden rounded border border-cyan-300/35 bg-[#050611]/94 p-3 text-xs leading-relaxed text-cyan-100 shadow-[0_0_28px_rgba(0,240,255,0.2)] backdrop-blur">
            <div className="truncate font-semibold text-cyan-50">{selectedCollection.title}</div>
            <div className="mt-1 text-cyan-200/60">{selectedCollection.articleCount} 篇文章</div>
            <a className="mt-2 inline-block text-cyan-100 underline underline-offset-4" href={`/collections/${selectedCollection.slug}`}>进入合集</a>
          </div>
        </Html>
      ) : null}
      {selectedServer && selectedServerPosition ? (
        <Html position={[selectedServerPosition.x - 0.45, selectedServerPosition.y + 0.3, selectedServerPosition.z]} center distanceFactor={6} zIndexRange={[40, 20]}>
          <div data-server-unit-card className="whitespace-nowrap rounded border border-cyan-300/35 bg-[#050611]/94 px-3 py-2 font-mono text-[10px] leading-relaxed text-cyan-100 shadow-[0_0_28px_rgba(0,240,255,0.18)] backdrop-blur">
            <div className="font-semibold text-cyan-50">NODE {String(selectedServerIndex + 1).padStart(2, '0')}</div>
            <div className={selectedDeploy?.status === 'failure' ? 'text-pink-400' : selectedDeploy?.status === 'deploying' ? 'text-amber-300' : 'text-cyan-300'}>{selectedDeploy?.status.toUpperCase() ?? 'STANDBY'}</div>
            <div className="max-w-52 truncate text-cyan-200/65">{selectedDeploy?.message ?? '暂无部署记录'}</div>
            {selectedDeploy ? <div className="text-cyan-200/40">{selectedDeploy.commit} · {selectedDeploy.version}</div> : null}
          </div>
        </Html>
      ) : null}
    </>
  );
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const pointer = useRef(new THREE.Vector2());

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointer.current.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  useFrame(({ camera }) => {
    if (!reducedMotion) {
      camera.position.x += (-2.85 + pointer.current.x * 0.2 - camera.position.x) * 0.05;
      camera.position.y += (2.2 + pointer.current.y * 0.1 - camera.position.y) * 0.05;
    }
    camera.position.z += (2.9 - camera.position.z) * 0.08;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (68 - camera.fov) * 0.05;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0.25, 1.02, -1.35);
  });

  return null;
}

function LoadingModel({ variant }: { variant: HomepageSceneVariant }) {
  return (
    <Html center>
      <div className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.34em] ${variant === 'day' ? 'text-sky-900/55' : 'text-cyan-100/55'}`}>
        Loading room / 载入场景
      </div>
    </Html>
  );
}

function CameraFlight({ focus }: { focus: FocusPreset }) {
  const target = useRef(new THREE.Vector3(...focus.target));
  const position = useRef(new THREE.Vector3(...focus.position));

  useEffect(() => {
    target.current.set(...focus.target);
    position.current.set(...focus.position);
  }, [focus]);

  useFrame(({ camera }) => {
    camera.position.lerp(position.current, 0.075);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (focus.fov - camera.fov) * 0.075;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target.current);
  });
  return null;
}

function SceneHotspots({ presets, onSelect }: { presets: Record<FocusKey, FocusPreset>; onSelect: (key: FocusKey) => void }) {
  return (
    <>
      {(Object.keys(FOCUS_PRESETS) as Array<Exclude<FocusKey, 'default'>>).map((key) => {
        const preset = presets[key];
        if (!preset) return null;
        return (
          <Html key={key} position={preset.marker} center distanceFactor={7} zIndexRange={[30, 10]}>
            <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(key); }} className="flex cursor-pointer items-center gap-2 whitespace-nowrap border border-cyan-200/55 bg-[#050611]/72 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50/90 shadow-[0_0_24px_rgba(34,211,238,0.22)] backdrop-blur transition hover:border-cyan-100 hover:bg-cyan-200/16">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.95)]" />
              {preset.label}
            </button>
          </Html>
        );
      })}
    </>
  );
}

function RoomEnvelope({ variant }: { variant: HomepageSceneVariant }) {
  const wallColor = variant === 'day' ? '#f1f5f9' : '#171d29';
  return (
    <>
      <mesh position={[0, 2.425, -3.65]}>
        <planeGeometry args={[7.2, 4.85]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      <mesh position={[-3.6, 2.425, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7.3, 4.85]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      <mesh position={[3.6, 2.425, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[7.3, 4.85]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
    </>
  );
}

function configureRenderer(renderer: THREE.WebGLRenderer, variant: HomepageSceneVariant) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = variant === 'night' ? 1.62 : 1.05;
}

function RendererTuning({ variant }: { variant: HomepageSceneVariant }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    configureRenderer(gl, variant);
  }, [gl, variant]);

  return null;
}

function LoadedSceneFillLights({ variant }: { variant: HomepageSceneVariant }) {
  if (variant === 'day') return null;

  return (
    <>
      <ambientLight color="#8aa8c6" intensity={0.52} />
      <hemisphereLight color="#a8d8ff" groundColor="#29213d" intensity={1.38} />
      <directionalLight position={[-4.5, 6.2, 3.8]} color="#b6dbff" intensity={1.42} />
      <pointLight position={[-1.8, 2.4, 1.8]} color="#6fd1f4" intensity={2.35} distance={10} decay={1.55} />
      <pointLight position={[2.5, 2.1, 1.1]} color="#f092c7" intensity={1.2} distance={8.5} decay={1.65} />
    </>
  );
}

function Scene({
  variant,
  reducedMotion,
  posts,
  collections,
  deployHistory,
  screenData,
  articleIndex,
  activeFocus,
  interactive,
  focusPresets,
  onFocusReady,
  onFocusSelect,
  heroVisible,
}: {
  variant: HomepageSceneVariant;
  reducedMotion: boolean;
  posts: Post[];
  collections: BookshelfCollection[];
  deployHistory: ReturnType<typeof useSceneActivityData>['deployHistory'];
  screenData: ReturnType<typeof useMonitorScreenData>;
  articleIndex: number;
  activeFocus: FocusKey;
  interactive: boolean;
  focusPresets: Record<FocusKey, FocusPreset>;
  onFocusReady: (presets: Record<FocusKey, FocusPreset>) => void;
  onFocusSelect: (key: FocusKey) => void;
  heroVisible: boolean;
}) {
  const night = variant === 'night';
  const preset = HOMEPAGE_THEME_PRESETS[variant];

  return (
    <>
      <color attach="background" args={[preset.background]} />
      <fog attach="fog" args={[preset.scene.fogColor, preset.scene.fogNear, preset.scene.fogFar]} />
      <RendererTuning variant={variant} />
      <SceneLights variant={variant} />
      <LoadedSceneFillLights variant={variant} />
      <RoomEnvelope variant={variant} />
      <WindowScene variant={variant} />
      <Suspense fallback={<LoadingModel variant={variant} />}>
        <SceneModel variant={variant} posts={posts} collections={collections} deployHistory={deployHistory} screenData={screenData} articleIndex={articleIndex} onFocusReady={onFocusReady} />
      </Suspense>
      {activeFocus === 'default' && !interactive ? <CameraRig reducedMotion={reducedMotion} /> : null}
      {activeFocus !== 'default' && !interactive ? <CameraFlight focus={focusPresets[activeFocus]} /> : null}
      {activeFocus === 'default' && !interactive ? <SceneHotspots presets={focusPresets} onSelect={onFocusSelect} /> : null}
      {interactive ? <OrbitControls makeDefault enableDamping enablePan={false} minDistance={2} maxDistance={14} minPolarAngle={0.25} maxPolarAngle={1.5} target={focusPresets[activeFocus].target} /> : null}
      {night && !reducedMotion ? <RainEffect count={240} enabled={heroVisible} /> : null}
      <EffectComposer multisampling={8}>
        <Bloom intensity={preset.postProcessing.bloomIntensity} luminanceThreshold={preset.postProcessing.bloomThreshold} luminanceSmoothing={preset.postProcessing.bloomSmoothing} mipmapBlur />
        <Vignette darkness={preset.postProcessing.vignetteDarkness} offset={0.1} />
      </EffectComposer>
    </>
  );
}

function HeroInterfaceOverlay({
  sceneReady,
  variant,
  interactiveMode,
  activeFocusKey,
  isDefaultMode,
  onHotspotActivate,
  onFreeExplore,
}: {
  sceneReady: boolean;
  variant: HomepageSceneVariant;
  interactiveMode: boolean;
  activeFocusKey: FocusKey;
  isDefaultMode: boolean;
  onHotspotActivate: (key: FocusKey) => void;
  onFreeExplore: () => void;
}) {
  const isDay = variant === 'day';
  const statuses = isDay
    ? ['DAY ROOM', 'CLEAR WINDOW', 'NOTES READY', 'LOW BLOOM']
    : ['ROOM ONLINE', 'RAIN 73%', 'POST ARCHIVE LINKED', 'BLOOM ACTIVE'];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div className="absolute inset-0 transition-transform duration-700 ease-in-out" style={{ transform: isDefaultMode ? 'none' : 'translateX(-100%)' }}>
        <div className="cyberpunk-hero-atmosphere" />
        {!isDay ? <div className="cyberpunk-scanline" /> : null}
        <div className={`absolute left-4 right-4 top-[14vh] max-w-5xl transition-all duration-700 md:left-10 lg:left-16 ${sceneReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-sky-900/65 dark:text-cyan-100/65">
            <span className="cyberpunk-kicker">{isDay ? 'NEON NOMAD / DAYLIGHT NOTES' : 'NEON NOMAD / NIGHT ZONES'}</span>
            <span className="h-px w-10 bg-sky-500/40 dark:bg-cyan-300/40" />
            <span>{isDay ? 'SUNLIT SESSION' : '2147 RAIN SESSION'}</span>
          </div>
          <h1 className="cyberpunk-hero-title">NNNNzs</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-700/78 dark:text-slate-200/74 md:text-base">
            {selectStyleText(bannerCopy.subtitle, variant)}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {statuses.map((status) => <span key={status} className="cyberpunk-status-chip">{status}</span>)}
          </div>
        </div>
      </div>

      {!isDefaultMode ? (
        <div className={`absolute bottom-24 right-4 z-20 w-40 transition-all duration-500 md:bottom-auto md:right-8 md:top-1/2 md:-translate-y-1/2 ${sceneReady ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`}>
          <div className="mb-2 border border-cyan-300/25 bg-white/42 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-950/62 backdrop-blur dark:bg-[#050611]/72 dark:text-cyan-100/72">热点区</div>
          <div className="flex flex-col gap-2">
            {(Object.keys(FOCUS_PRESETS) as Array<Exclude<FocusKey, 'default'>>).map((key) => {
              const active = !interactiveMode && activeFocusKey === key;
              const tone = isDay
                ? active
                  ? 'border-sky-500/70 bg-sky-100/82 text-sky-950 shadow-[0_0_24px_rgba(14,165,233,0.18)]'
                  : 'border-sky-500/24 bg-white/72 text-sky-950/72 hover:border-sky-500/55 hover:bg-sky-50/86 hover:text-sky-950'
                : active
                  ? 'border-cyan-300/80 bg-cyan-200/20 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.24)]'
                  : 'border-white/18 bg-[#050611]/50 text-slate-100/76 hover:border-cyan-300/55 hover:text-cyan-50';
              return (
                <button key={key} type="button" onDoubleClick={(event) => event.stopPropagation()} onClick={() => onHotspotActivate(key)} className={`pointer-events-auto flex cursor-pointer items-center justify-between gap-2 border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur transition ${tone}`}>
                  <span>{FOCUS_PRESETS[key].label}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? isDay ? 'bg-sky-600' : 'bg-cyan-200' : isDay ? 'bg-sky-400/45' : 'bg-white/45'}`} />
                </button>
              );
            })}
            <button type="button" onDoubleClick={(event) => event.stopPropagation()} onClick={onFreeExplore} className={`pointer-events-auto flex cursor-pointer items-center justify-between gap-2 border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur transition ${interactiveMode ? isDay ? 'border-sky-500/70 bg-sky-100/82 text-sky-950' : 'border-cyan-300/80 bg-cyan-200/20 text-cyan-50' : isDay ? 'border-sky-500/24 bg-white/72 text-sky-950/72 hover:border-sky-500/55' : 'border-white/18 bg-[#050611]/50 text-slate-100/76 hover:border-cyan-300/55'}`}>
              <span>自由探索</span>
              <span className={`h-1.5 w-1.5 rounded-full ${interactiveMode ? isDay ? 'bg-sky-600' : 'bg-cyan-200' : isDay ? 'bg-sky-400/45' : 'bg-white/45'}`} />
            </button>
          </div>
        </div>
      ) : null}

      {interactiveMode ? (
        <div className="absolute bottom-24 left-4 right-4 z-20 mx-auto max-w-sm border border-cyan-300/35 bg-[#050611]/76 px-4 py-3 text-center text-xs uppercase tracking-[0.2em] text-cyan-100/78 shadow-[0_0_34px_rgba(34,211,238,0.16)] backdrop-blur md:bottom-8">
          拖动旋转场景，双指缩放。右键或双击退出。
        </div>
      ) : null}
    </div>
  );
}

export default function LoadedSceneBanner({ variant = 'night', posts = [], collections = [] }: {
  variant?: HomepageSceneVariant;
  posts?: Post[];
  collections?: BookshelfCollection[];
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [articleIndex, setArticleIndex] = useState(0);
  const [activeFocus, setActiveFocus] = useState<FocusKey>('default');
  const [interactive, setInteractive] = useState(false);
  const [focusPresets, setFocusPresets] = useState<Record<FocusKey, FocusPreset>>({ default: DEFAULT_FOCUS } as Record<FocusKey, FocusPreset>);
  const { commits, deployHistory } = useSceneActivityData();
  const screenData = useMonitorScreenData(posts, commits, deployHistory);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateScrollProgress = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setScrollProgress(Math.max(0, window.scrollY / Math.max(window.innerHeight, 1)));
      });
    };
    updateScrollProgress();
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateScrollProgress);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (posts.length < 2 || reducedMotion) return;
    const timer = window.setInterval(() => {
      setArticleIndex((current) => (current + 1) % Math.min(posts.length, 5));
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [posts.length, reducedMotion]);

  const handleFocusReady = useCallback((presets: Record<FocusKey, FocusPreset>) => {
    setFocusPresets(presets);
    setSceneReady(true);
  }, []);

  const handleFocusSelect = useCallback((key: FocusKey) => {
    setInteractive(false);
    setActiveFocus(key);
  }, []);

  const returnToOverview = useCallback(() => {
    setInteractive(false);
    setActiveFocus('default');
  }, []);

  const enterFreeExplore = useCallback(() => {
    setInteractive(true);
  }, []);

  const handleSceneDoubleClick = useCallback(() => {
    if (interactive) {
      returnToOverview();
      return;
    }
    enterFreeExplore();
  }, [enterFreeExplore, interactive, returnToOverview]);

  const isDefaultMode = !interactive && activeFocus === 'default';

  useEffect(() => {
    const handleWindowDoubleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
      handleSceneDoubleClick();
    };
    window.addEventListener('dblclick', handleWindowDoubleClick);
    return () => window.removeEventListener('dblclick', handleWindowDoubleClick);
  }, [handleSceneDoubleClick]);

  useEffect(() => {
    if (isDefaultMode) return;
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      returnToOverview();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, [isDefaultMode, returnToOverview]);

  const scrollToPosts = useCallback(() => {
    window.scrollTo({ top: window.innerHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);
  const night = variant === 'night';
  const heroVisible = scrollProgress < 1.05;

  return (
    <section className={`relative h-screen overflow-hidden ${night ? 'bg-[#050611]' : 'bg-[#f8fafc]'}`} aria-label="首页三维房间">
      <div className="absolute inset-0 cursor-crosshair transition-opacity duration-1000" style={{ opacity: sceneReady ? 1 : 0, touchAction: interactive ? 'none' : 'pan-y' }}>
        <SceneErrorBoundary>
          <Canvas camera={{ position: DEFAULT_FOCUS.position, fov: DEFAULT_FOCUS.fov, near: 0.1, far: 200 }} dpr={[1, 3]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
            <Scene
              variant={variant}
              reducedMotion={reducedMotion}
              posts={posts}
              collections={collections}
              deployHistory={deployHistory}
              screenData={screenData}
              articleIndex={articleIndex}
              activeFocus={activeFocus}
              interactive={interactive}
              focusPresets={focusPresets}
              onFocusReady={handleFocusReady}
              onFocusSelect={handleFocusSelect}
              heroVisible={heroVisible}
            />
          </Canvas>
        </SceneErrorBoundary>
      </div>

      <HeroInterfaceOverlay
        sceneReady={sceneReady}
        variant={variant}
        interactiveMode={interactive}
        activeFocusKey={activeFocus}
        isDefaultMode={isDefaultMode}
        onHotspotActivate={handleFocusSelect}
        onFreeExplore={enterFreeExplore}
      />

      <button type="button" onClick={scrollToPosts} className={`absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2 bg-transparent text-center transition-colors ${night ? 'text-cyan-100/65 hover:text-cyan-50' : 'text-sky-950/60 hover:text-sky-950'}`} aria-label="查看文章列表">
        <span className="font-mono text-[10px] uppercase tracking-[0.36em]">logs</span>
        <DownOutlined className={reducedMotion ? 'text-3xl' : 'animate-bounce text-3xl'} />
      </button>
      <div data-scene-scroll-fade className={`pointer-events-none absolute inset-0 z-30 ${night ? 'bg-[#050611]' : 'bg-[#f8fafc]'}`} style={{ opacity: Math.min(scrollProgress * 1.65, 1) }} />
    </section>
  );
}

useGLTF.preload(MODEL_URL);
