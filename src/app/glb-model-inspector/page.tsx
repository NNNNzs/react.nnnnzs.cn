"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, OrbitControls } from "@react-three/drei";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import styles from "./page.module.css";

type ModelAsset = {
  id: string;
  file: string;
  name: string;
  source: string;
  sizeHuman: string;
  priority: "P0" | "P1" | "P2";
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

const DOWNLOAD_BASE = "https://r2-file-manager.nnnnzs.workers.dev/api/download/cyberpunk";

const MODEL_ASSETS: ModelAsset[] = [
  {
    id: "bed",
    file: "bed.glb",
    name: "床 / Neon Bedroom",
    source: "Sketchfab",
    sizeHuman: "6.3MB",
    priority: "P0",
    zone: "睡眠区",
    position: "左侧靠墙",
    notes: "完整卧室场景模型，可能需要拆出床体部分。",
  },
  {
    id: "desk",
    file: "desk.glb",
    name: "桌子 / Lumen hologram Table",
    source: "Sketchfab",
    sizeHuman: "1.7MB",
    priority: "P0",
    zone: "工作区",
    position: "中央偏右",
    notes: "低面数全息桌，适合做工作台。",
  },
  {
    id: "monitors",
    file: "monitors.glb",
    name: "双显示器 / Gaming Desk",
    source: "Sketchfab",
    sizeHuman: "0.2MB",
    priority: "P1",
    zone: "工作区",
    position: "桌上",
    notes: "体积极小，需检查是否包含完整桌面组合。",
  },
  {
    id: "bookshelf",
    file: "bookshelf.glb",
    name: "书架 / Wooden Bookcases",
    source: "Sketchfab",
    sizeHuman: "3.0MB",
    priority: "P0",
    zone: "存储/服务器区",
    position: "右侧靠墙",
    notes: "后续可映射博客合集数据。",
  },
  {
    id: "server-rack",
    file: "server-rack.glb",
    name: "服务器机架 / Server Racking",
    source: "Sketchfab",
    sizeHuman: "13MB",
    priority: "P0",
    zone: "存储/服务器区",
    position: "右侧角落",
    notes: "适合对应运维合集，可检查 LED 材质。",
  },
  {
    id: "keyboard",
    file: "keyboard.glb",
    name: "键盘 / NZXT miniTKL Keyboard",
    source: "Sketchfab",
    sizeHuman: "18MB",
    priority: "P1",
    zone: "工作区",
    position: "桌上",
    notes: "体积偏大，建议重点看面数和贴图数量。",
  },
  {
    id: "neon-sign",
    file: "neon-sign.glb",
    name: "霓虹灯牌 / Japanese LED Neon Sign",
    source: "Sketchfab",
    sizeHuman: "8.0MB",
    priority: "P1",
    zone: "墙面装饰",
    position: "床头或窗户上方",
    notes: "如果含动画，可直接作为夜间氛围焦点。",
  },
  {
    id: "chair",
    file: "chair.glb",
    name: "电竞椅 / Cyberpunk Gaming Chair",
    source: "Sketchfab",
    sizeHuman: "3.8MB",
    priority: "P2",
    zone: "工作区",
    position: "工作桌前",
    notes: "可替换当前程序化椅子。",
  },
  {
    id: "coffee-mug",
    file: "coffee-mug.glb",
    name: "咖啡杯 / Coffee Mug",
    source: "Sketchfab",
    sizeHuman: "8.6MB",
    priority: "P2",
    zone: "工作区",
    position: "桌上",
    notes: "生活感小物件，需看尺寸比例。",
  },
  {
    id: "plant",
    file: "plant.glb",
    name: "盆栽 / Potted Plant",
    source: "Sketchfab",
    sizeHuman: "38MB",
    priority: "P2",
    zone: "生活细节",
    position: "角落或桌面",
    notes: "体积过大，集成前建议压缩或替换。",
  },
  {
    id: "robot-cat",
    file: "robot-cat.glb",
    name: "机器人宠物 / Sox Lightyear",
    source: "Sketchfab",
    sizeHuman: "16MB",
    priority: "P2",
    zone: "生活细节",
    position: "地面或桌旁",
    notes: "生活感和科技感较强，适合作为可交互物件。",
  },
  {
    id: "retro-computer",
    file: "retro-computer.glb",
    name: "复古电脑 / Retro Computer",
    source: "Sketchfab",
    sizeHuman: "2.4MB",
    priority: "P2",
    zone: "工作区",
    position: "桌上或角落",
    notes: "增强房间层次感。",
  },
  {
    id: "nightstand",
    file: "nightstand.glb",
    name: "床头柜 / Dormitory Assets",
    source: "Sketchfab",
    sizeHuman: "11MB",
    priority: "P2",
    zone: "睡眠区",
    position: "床旁",
    notes: "可能是资产包，需检查是否能单独提取床头柜。",
  },
  {
    id: "jacket",
    file: "jacket.glb",
    name: "外套 / Clothes",
    source: "Sketchfab",
    sizeHuman: "18MB",
    priority: "P2",
    zone: "生活细节",
    position: "椅背上",
    notes: "体积偏大，集成前先确认是否值得保留。",
  },
];

const formatNumber = (value: number) => new Intl.NumberFormat("zh-CN").format(value);

function getModelUrl(file: string) {
  return `${DOWNLOAD_BASE}/${file}`;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
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
    triangles += geometry.index ? geometry.index.count / 3 : (position?.count ?? 0) / 3;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
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
  const [loadResult, setLoadResult] = useState<LoadResult>({
    url: "",
    gltf: null,
    stats: null,
    progress: 0,
    error: null,
  });

  const selectedModel = useMemo(
    () => MODEL_ASSETS.find((item) => item.id === selectedId) ?? MODEL_ASSETS[0],
    [selectedId],
  );
  const activeUrl = customMode && customUrl.trim() ? customUrl.trim() : getModelUrl(selectedModel.file);
  const gltf = loadResult.url === activeUrl ? loadResult.gltf : null;
  const stats = loadResult.url === activeUrl ? loadResult.stats : null;
  const progress = loadResult.url === activeUrl ? loadResult.progress : 0;
  const error = loadResult.url === activeUrl ? loadResult.error : null;

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();

    loader.load(
      activeUrl,
      (loaded) => {
        if (cancelled) {
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
        if (!event.lengthComputable) return;
        setLoadResult((previous) => ({
          ...previous,
          url: activeUrl,
          progress: Math.round((event.loaded / event.total) * 100),
          error: null,
        }));
      },
      (loadError) => {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : "模型加载失败，请检查地址、CORS 或文件格式。";
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
      },
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
          <p className={styles.summary}>读取 R2 中的 GLB 模型，快速查看体积、场景节点、几何面数、材质、贴图和动画信息。</p>
        </div>
        <a className={styles.openLink} href={activeUrl} target="_blank" rel="noreferrer">
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
              <input type="checkbox" checked={customMode} onChange={(event) => setCustomMode(event.target.checked)} />
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
                className={`${styles.modelButton} ${model.id === selectedId && !customMode ? styles.activeModel : ""}`}
                key={model.id}
                onClick={() => {
                  setCustomMode(false);
                  setSelectedId(model.id);
                }}
                type="button"
              >
                <span>
                  <strong>{model.name}</strong>
                  <small>{model.zone} · {model.sizeHuman}</small>
                </span>
                <em>{model.priority}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.viewerPanel}>
          <div className={styles.viewerToolbar}>
            <div>
              <span className={styles.fileName}>{customMode ? "custom.glb" : selectedModel.file}</span>
              <p>{customMode ? activeUrl : `${selectedModel.source} · ${selectedModel.position}`}</p>
            </div>
            <span className={styles.progress}>{gltf ? "READY" : error ? "ERROR" : `LOADING ${progress}%`}</span>
          </div>

          <div className={styles.viewer}>
            {error ? (
              <div className={styles.errorState}>
                <strong>加载失败</strong>
                <span>{error}</span>
              </div>
            ) : (
              <Canvas camera={{ position: [3, 2.2, 4], fov: 45 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
                <color attach="background" args={["#101826"]} />
                <ambientLight intensity={0.9} />
                <directionalLight position={[4, 6, 3]} intensity={2.2} />
                <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#80eaff" />
                <gridHelper args={[8, 16, "#466176", "#263848"]} position={[0, -0.01, 0]} />
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
              <p>{customMode ? "自定义模型地址只在当前检查页中使用，不会写入项目清单。" : selectedModel.notes}</p>
              <code>{activeUrl}</code>
            </div>

            <div className={styles.statsPanel}>
              <StatTile label="Meshes" value={stats ? formatNumber(stats.meshes) : "-"} />
              <StatTile label="Nodes" value={stats ? formatNumber(stats.nodes) : "-"} />
              <StatTile label="Materials" value={stats ? formatNumber(stats.materials) : "-"} />
              <StatTile label="Textures" value={stats ? formatNumber(stats.textures) : "-"} />
              <StatTile label="Vertices" value={stats ? formatNumber(stats.vertices) : "-"} />
              <StatTile label="Triangles" value={stats ? formatNumber(stats.triangles) : "-"} />
              <StatTile label="Animations" value={stats ? formatNumber(stats.animations) : "-"} />
              <StatTile
                label="Bounds"
                value={stats ? stats.dimensions.map((item) => item.toFixed(2)).join(" x ") : "-"}
              />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
