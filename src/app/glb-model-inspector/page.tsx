"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, OrbitControls } from "@react-three/drei";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import styles from "./page.module.css";
import manifest from "../../../docs/reference/3d-assets-manifest.json";
type ModelAsset = {
  id: string;
  file: string;
  // file: string;
  source: string;
  sizeHuman: string;
  priority: string;
  zone: string;
  position: string;
  notes: string;
};

type ModelStats = {
  meshes: number;
  nodes: number;
  materials: number;
  textures: number;
  vertices: number;
  triangles: number;
  animations: number;
  dimensions: [number, number, number];
};

type LoadResult = {
  url: string;
  gltf: GLTF | null;
  stats: ModelStats | null;
  progress: number;
  error: string | null;
};

const DOWNLOAD_BASE =
  "https://r2-file-manager.nnnnzs.workers.dev/api/download/cyberpunk";

const MODEL_ASSETS: ModelAsset[] =manifest.assets.models;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("zh-CN").format(value);

function getModelUrl(file: string) {
  return `${DOWNLOAD_BASE}/${file}`;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry?.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      });
      material.dispose();
    });
  });
}

function inspectGltf(gltf: GLTF): ModelStats {
  const materialSet = new Set<THREE.Material>();
  const textureSet = new Set<THREE.Texture>();
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);

  let meshes = 0;
  let nodes = 0;
  let vertices = 0;
  let triangles = 0;

  gltf.scene.traverse((child) => {
    nodes += 1;

    if (!(child instanceof THREE.Mesh)) return;
    meshes += 1;

    const geometry = child.geometry;
    const position = geometry.getAttribute("position");
    vertices += position?.count ?? 0;
    triangles += geometry.index
      ? geometry.index.count / 3
      : (position?.count ?? 0) / 3;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      materialSet.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) {
          textureSet.add(value);
        }
      });
    });
  });

  return {
    meshes,
    nodes,
    materials: materialSet.size,
    textures: textureSet.size,
    vertices,
    triangles: Math.round(triangles),
    animations: gltf.animations.length,
    dimensions: [size.x, size.y, size.z],
  };
}

function LoadedModel({ scene }: { scene: THREE.Group }) {
  return (
    <Bounds fit clip observe margin={1.25}>
      <Center>
        <primitive object={scene} />
      </Center>
    </Bounds>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function GlbModelInspectorPage() {
  const [selectedId, setSelectedId] = useState(MODEL_ASSETS[0].id);
  const [customUrl, setCustomUrl] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const requestIdRef = useRef(0);
  const [loadResult, setLoadResult] = useState<LoadResult>({
    url: "",
    gltf: null,
    stats: null,
    progress: 0,
    error: null,
  });

  const selectedModel = useMemo(
    () =>
      MODEL_ASSETS.find((item) => item.id === selectedId) ?? MODEL_ASSETS[0],
    [selectedId]
  );
  const activeUrl =
    customMode && customUrl.trim()
      ? customUrl.trim()
      : getModelUrl(selectedModel.file);
  const gltf = loadResult.url === activeUrl ? loadResult.gltf : null;
  const stats = loadResult.url === activeUrl ? loadResult.stats : null;
  const progress = loadResult.url === activeUrl ? loadResult.progress : 0;
  const error = loadResult.url === activeUrl ? loadResult.error : null;

  useEffect(() => {
    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const loader = new GLTFLoader();

    loader.load(
      activeUrl,
      (loaded) => {
        if (cancelled || requestIdRef.current !== requestId) {
          disposeObject(loaded.scene);
          return;
        }
        setLoadResult((previous) => {
          if (previous.gltf && previous.gltf !== loaded) {
            disposeObject(previous.gltf.scene);
          }

          return {
            url: activeUrl,
            gltf: loaded,
            stats: inspectGltf(loaded),
            progress: 100,
            error: null,
          };
        });
      },
      (event) => {
        if (
          !event.lengthComputable ||
          cancelled ||
          requestIdRef.current !== requestId
        ) {
          return;
        }
        setLoadResult({
          url: activeUrl,
          gltf: null,
          stats: null,
          progress: Math.round((event.loaded / event.total) * 100),
          error: null,
        });
      },
      (loadError) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "模型加载失败，请检查地址、CORS 或文件格式。";
        setLoadResult((previous) => {
          if (previous.gltf) {
            disposeObject(previous.gltf.scene);
          }

          return {
            url: activeUrl,
            gltf: null,
            stats: null,
            progress: 0,
            error: message,
          };
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [activeUrl]);

  useEffect(() => {
    return () => {
      if (loadResult.gltf) {
        disposeObject(loadResult.gltf.scene);
      }
    };
  }, [loadResult.gltf]);

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.eyebrow}>GLB Model Inspector</p>
          <h1>赛博朋克房间模型检查台</h1>
          <p className={styles.summary}>
            读取 R2 中的 GLB
            模型，快速查看体积、场景节点、几何面数、材质、贴图和动画信息。
          </p>
        </div>
        <a
          className={styles.openLink}
          href={activeUrl}
          target="_blank"
          rel="noreferrer"
        >
          打开当前 GLB
        </a>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span>模型清单</span>
            <strong>{MODEL_ASSETS.length}</strong>
          </div>

          <div className={styles.customPanel}>
            <label className={styles.switchRow}>
              <input
                type="checkbox"
                checked={customMode}
                onChange={(event) => setCustomMode(event.target.checked)}
              />
              <span>检查自定义地址</span>
            </label>
            <input
              className={styles.urlInput}
              value={customUrl}
              onChange={(event) => setCustomUrl(event.target.value)}
              placeholder="https://.../model.glb"
              disabled={!customMode}
            />
          </div>

          <div className={styles.modelList}>
            {MODEL_ASSETS.map((model) => (
              <button
                className={`${styles.modelButton} ${
                  model.id === selectedId && !customMode
                    ? styles.activeModel
                    : ""
                }`}
                key={model.id}
                onClick={() => {
                  setCustomMode(false);
                  setSelectedId(model.id);
                }}
                type="button"
              >
                <span>
                  <strong>{model.file}</strong>
                  <small>
                    {model.zone} · {model.sizeHuman}
                  </small>
                </span>
                <em>{model.priority}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.viewerPanel}>
          <div className={styles.viewerToolbar}>
            <div>
              <span className={styles.fileName}>
                {customMode ? "custom.glb" : selectedModel.file}
              </span>
              <p>
                {customMode
                  ? activeUrl
                  : `${selectedModel.source} · ${selectedModel.position}`}
              </p>
            </div>
            <span className={styles.progress}>
              {gltf ? "READY" : error ? "ERROR" : `LOADING ${progress}%`}
            </span>
          </div>

          <div className={styles.viewer}>
            {error ? (
              <div className={styles.errorState}>
                <strong>加载失败</strong>
                <span>{error}</span>
              </div>
            ) : (
              <Canvas
                camera={{ position: [3, 2.2, 4], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 1.5]}
              >
                <color attach="background" args={["#101826"]} />
                <ambientLight intensity={0.9} />
                <directionalLight position={[4, 6, 3]} intensity={2.2} />
                <directionalLight
                  position={[-4, 2, -3]}
                  intensity={0.8}
                  color="#80eaff"
                />
                <gridHelper
                  args={[8, 16, "#466176", "#263848"]}
                  position={[0, -0.01, 0]}
                />
                <Suspense fallback={null}>
                  {gltf && <LoadedModel scene={gltf.scene} />}
                </Suspense>
                <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
              </Canvas>
            )}
          </div>

          <div className={styles.detailGrid}>
            <div className={styles.notePanel}>
              <span>集成备注</span>
              <p>
                {customMode
                  ? "自定义模型地址只在当前检查页中使用，不会写入项目清单。"
                  : selectedModel.notes}
              </p>
              <code>{activeUrl}</code>
            </div>

            <div className={styles.statsPanel}>
              <StatTile
                label="Meshes"
                value={stats ? formatNumber(stats.meshes) : "-"}
              />
              <StatTile
                label="Nodes"
                value={stats ? formatNumber(stats.nodes) : "-"}
              />
              <StatTile
                label="Materials"
                value={stats ? formatNumber(stats.materials) : "-"}
              />
              <StatTile
                label="Textures"
                value={stats ? formatNumber(stats.textures) : "-"}
              />
              <StatTile
                label="Vertices"
                value={stats ? formatNumber(stats.vertices) : "-"}
              />
              <StatTile
                label="Triangles"
                value={stats ? formatNumber(stats.triangles) : "-"}
              />
              <StatTile
                label="Animations"
                value={stats ? formatNumber(stats.animations) : "-"}
              />
              <StatTile
                label="Bounds"
                value={
                  stats
                    ? stats.dimensions
                        .map((item) => item.toFixed(2))
                        .join(" x ")
                    : "-"
                }
              />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
