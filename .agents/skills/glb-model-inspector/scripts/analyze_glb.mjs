#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");

function usage() {
  console.error("Usage: node scripts/analyze_glb.mjs <url-or-file.glb|gltf> [--json]");
  process.exit(2);
}

const input = process.argv[2];
const asJson = process.argv.includes("--json");
if (!input) usage();

async function importGltfTransform() {
  try {
    const core = await import("@gltf-transform/core");
    const extensions = await import("@gltf-transform/extensions");
    return { ...core, ...extensions };
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" || /Cannot find package/.test(error.message)) {
      throw new Error(
        `Missing dependencies. Run "npm install" in ${skillRoot}, then retry.`
      );
    }
    throw error;
  }
}

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

async function loadInput(target) {
  if (isUrl(target)) {
    const response = await fetch(target, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${target}`);
    const contentType = response.headers.get("content-type") || "";
    const arrayBuffer = await response.arrayBuffer();
    return {
      source: target,
      baseURI: target,
      contentType,
      bytes: new Uint8Array(arrayBuffer),
      sizeBytes: arrayBuffer.byteLength,
      format: target.toLowerCase().split("?")[0].endsWith(".gltf") ? "gltf-json" : "glb",
    };
  }

  const resolved = path.resolve(target);
  const bytes = await fs.readFile(resolved);
  return {
    source: resolved,
    baseURI: resolved,
    contentType: "",
    bytes: new Uint8Array(bytes),
    sizeBytes: bytes.byteLength,
    format: resolved.toLowerCase().endsWith(".gltf") ? "gltf-json" : "glb",
  };
}

function createIO(mod) {
  const io = new mod.NodeIO();
  if (mod.ALL_EXTENSIONS) io.registerExtensions(mod.ALL_EXTENSIONS);
  return io;
}

async function readDocument(io, loaded) {
  if (loaded.format === "gltf-json") {
    const tempDir = await fs.mkdtemp(path.join(process.env.TEMP || process.env.TMP || "C:/tmp", "glb-inspector-"));
    const tempPath = path.join(tempDir, "model.gltf");
    await fs.writeFile(tempPath, Buffer.from(loaded.bytes));
    return io.read(tempPath);
  }
  return io.readBinary(loaded.bytes);
}

function textureIndex(texture, textures) {
  return texture ? textures.indexOf(texture) : -1;
}

function imageDimensions(texture) {
  const image = texture?.getImage?.();
  return image ? detectImageDimensions(Buffer.from(image)) : null;
}

function detectImageDimensions(bytes) {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function textureSlots(material) {
  const slots = [];
  if (material.getBaseColorTexture()) slots.push("baseColorTexture");
  if (material.getMetallicRoughnessTexture()) slots.push("metallicRoughnessTexture");
  if (material.getNormalTexture()) slots.push("normalTexture");
  if (material.getOcclusionTexture()) slots.push("occlusionTexture");
  if (material.getEmissiveTexture()) slots.push("emissiveTexture");
  return slots;
}

function isNearWhite(color) {
  const rgb = color?.slice(0, 3) || [1, 1, 1];
  return rgb.every((v) => v >= 0.82);
}

function primitiveTriangleCount(prim) {
  const indices = prim.getIndices();
  const position = prim.getAttribute("POSITION");
  const count = indices?.getCount() || position?.getCount() || 0;
  const mode = prim.getMode();

  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function getAnimationDuration(animation) {
  let duration = 0;
  for (const channel of animation.listChannels()) {
    const input = channel.getSampler()?.getInput();
    if (!input) continue;
    const array = input.getArray();
    if (!array?.length) continue;
    duration = Math.max(duration, Number(array[array.length - 1]) || 0);
  }
  return duration;
}

function safeName(property, fallback) {
  return property.getName?.() || fallback;
}

function analyze(document, loaded) {
  const root = document.getRoot();
  const json = document.getJSONDoc?.()?.json || {};

  const scenes = root.listScenes();
  const nodes = root.listNodes();
  const meshes = root.listMeshes();
  const materialsRaw = root.listMaterials();
  const texturesRaw = root.listTextures();
  const animationsRaw = root.listAnimations();
  const skins = root.listSkins();
  const accessors = root.listAccessors();
  const buffers = root.listBuffers();

  const primitiveSummaries = [];
  let totalVertices = 0;
  let totalTriangles = 0;
  let hasVertexColors = false;

  meshes.forEach((mesh, meshIndex) => {
    mesh.listPrimitives().forEach((prim, primitiveIndex) => {
      const attributes = prim.listAttributes();
      const attributeNames = attributes.map((attr) => attr.getSemantic?.() || attr.getName?.() || "UNKNOWN");
      const vertices = prim.getAttribute("POSITION")?.getCount() || 0;
      const triangles = primitiveTriangleCount(prim);
      hasVertexColors ||= attributeNames.some((name) => name.startsWith("COLOR_"));
      totalVertices += vertices;
      totalTriangles += triangles;
      primitiveSummaries.push({
        meshIndex,
        meshName: mesh.getName() || null,
        primitiveIndex,
        material: prim.getMaterial() ? materialsRaw.indexOf(prim.getMaterial()) : null,
        mode: prim.getMode(),
        attributes: attributeNames,
        vertices,
        triangles,
        indices: prim.getIndices()?.getCount() || 0,
      });
    });
  });

  const materials = materialsRaw.map((material, index) => {
    const slots = textureSlots(material);
    const baseColorFactor = material.getBaseColorFactor();
    return {
      index,
      name: material.getName() || null,
      baseColorFactor,
      metallicFactor: material.getMetallicFactor(),
      roughnessFactor: material.getRoughnessFactor(),
      alphaMode: material.getAlphaMode(),
      alphaCutoff: material.getAlphaCutoff(),
      doubleSided: material.getDoubleSided(),
      emissiveFactor: material.getEmissiveFactor(),
      textureSlots: slots,
      textures: {
        baseColorTexture: textureIndex(material.getBaseColorTexture(), texturesRaw),
        metallicRoughnessTexture: textureIndex(material.getMetallicRoughnessTexture(), texturesRaw),
        normalTexture: textureIndex(material.getNormalTexture(), texturesRaw),
        occlusionTexture: textureIndex(material.getOcclusionTexture(), texturesRaw),
        emissiveTexture: textureIndex(material.getEmissiveTexture(), texturesRaw),
      },
      likelyPlainWhite: slots.length === 0 && isNearWhite(baseColorFactor),
      extensions: material.listExtensionsUsed().map((ext) => ext.extensionName),
    };
  });

  const texturedMaterials = materials.filter((m) => m.textureSlots.length > 0).length;
  const plainWhiteMaterials = materials.filter((m) => m.likelyPlainWhite).length;
  const materialCount = materials.length;
  let whiteModelStatus = "uncertain";
  const whiteReasons = [];

  if (materialCount === 0 && texturesRaw.length === 0) {
    whiteModelStatus = "likely-white-or-default";
    whiteReasons.push("No materials or textures are defined; viewers will use defaults.");
  } else if (texturedMaterials === 0 && plainWhiteMaterials === materialCount && !hasVertexColors) {
    whiteModelStatus = "likely-white-model";
    whiteReasons.push("All materials are untextured and near white/default.");
  } else if (texturedMaterials > 0) {
    whiteModelStatus = texturedMaterials === materialCount ? "textured" : "mixed";
    whiteReasons.push(`${texturedMaterials}/${materialCount} materials use texture slots.`);
  } else if (hasVertexColors) {
    whiteModelStatus = "uncertain-vertex-colors";
    whiteReasons.push("No image textures found, but mesh primitives include vertex color attributes.");
  } else {
    whiteReasons.push("Materials are plain but not all near white.");
  }

  const textures = texturesRaw.map((texture, index) => {
    const image = texture.getImage();
    return {
      index,
      name: texture.getName() || null,
      mimeType: texture.getMimeType() || null,
      uri: texture.getURI() || null,
      byteLength: image?.byteLength || null,
      dimensions: imageDimensions(texture),
    };
  });

  const animations = animationsRaw.map((animation, index) => ({
    index,
    name: safeName(animation, null),
    durationSeconds: Number(getAnimationDuration(animation).toFixed(3)),
    channels: animation.listChannels().length,
    samplers: animation.listSamplers().length,
    targetPaths: animation.listChannels().map((channel) => channel.getTargetPath()),
    targetNodes: animation.listChannels().map((channel) => channel.getTargetNode()?.getName() || null),
  }));

  return {
    source: loaded.source,
    contentType: loaded.contentType || null,
    fileSizeBytes: loaded.sizeBytes,
    format: loaded.format,
    parser: "@gltf-transform/core",
    asset: json.asset || {},
    counts: {
      scenes: scenes.length,
      nodes: nodes.length,
      meshes: meshes.length,
      primitives: primitiveSummaries.length,
      materials: materials.length,
      textures: textures.length,
      animations: animations.length,
      skins: skins.length,
      accessors: accessors.length,
      buffers: buffers.length,
    },
    geometry: {
      approximateVertices: totalVertices,
      approximateTriangles: totalTriangles,
      hasVertexColors,
      primitives: primitiveSummaries,
    },
    animations,
    materials,
    textures,
    extensionsUsed: json.extensionsUsed || [],
    extensionsRequired: json.extensionsRequired || [],
    whiteModel: {
      status: whiteModelStatus,
      reasons: whiteReasons,
    },
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatReport(report) {
  const lines = [];
  lines.push("# GLB Model Report");
  lines.push(`Source: ${report.source}`);
  lines.push(`Size: ${formatBytes(report.fileSizeBytes)} | Format: ${report.format} | Parser: ${report.parser}`);
  if (report.asset.generator || report.asset.version) {
    lines.push(`Asset: version ${report.asset.version || "unknown"}${report.asset.generator ? `, generator ${report.asset.generator}` : ""}`);
  }
  lines.push("");
  lines.push("## Counts");
  lines.push(`Scenes ${report.counts.scenes}, nodes ${report.counts.nodes}, meshes ${report.counts.meshes}, primitives ${report.counts.primitives}`);
  lines.push(`Materials ${report.counts.materials}, textures ${report.counts.textures}, animations ${report.counts.animations}, skins ${report.counts.skins}`);
  lines.push("");
  lines.push("## Geometry");
  lines.push(`Approx vertices: ${report.geometry.approximateVertices}`);
  lines.push(`Approx triangles: ${report.geometry.approximateTriangles}`);
  lines.push(`Vertex colors: ${report.geometry.hasVertexColors ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Animations");
  if (report.animations.length === 0) {
    lines.push("No animations found.");
  } else {
    for (const anim of report.animations) {
      lines.push(`- ${anim.name || `Animation ${anim.index}`}: ${anim.durationSeconds}s, ${anim.channels} channels, targets ${[...new Set(anim.targetPaths)].join(", ")}`);
    }
  }
  lines.push("");
  lines.push("## Materials & Textures");
  if (report.materials.length === 0) {
    lines.push("No materials found.");
  } else {
    for (const mat of report.materials) {
      const color = mat.baseColorFactor.map((v) => Number(v).toFixed(2)).join(", ");
      const slots = mat.textureSlots.length ? mat.textureSlots.join(", ") : "no texture slots";
      lines.push(`- ${mat.name || `Material ${mat.index}`}: baseColor [${color}], ${slots}, alpha ${mat.alphaMode}`);
    }
  }
  if (report.textures.length) {
    lines.push("");
    lines.push("Textures:");
    for (const tex of report.textures) {
      const dims = tex.dimensions ? `${tex.dimensions.width}x${tex.dimensions.height}` : "unknown size";
      const size = tex.byteLength ? formatBytes(tex.byteLength) : "unknown bytes";
      lines.push(`- ${tex.name || `Texture ${tex.index}`}: ${tex.mimeType || "unknown MIME"}, ${dims}, ${size}`);
    }
  }
  lines.push("");
  lines.push("## White Model Assessment");
  lines.push(`Status: ${report.whiteModel.status}`);
  for (const reason of report.whiteModel.reasons) lines.push(`- ${reason}`);
  if (report.extensionsRequired.length || report.extensionsUsed.length) {
    lines.push("");
    lines.push("## Extensions");
    lines.push(`Used: ${report.extensionsUsed.join(", ") || "none"}`);
    lines.push(`Required: ${report.extensionsRequired.join(", ") || "none"}`);
  }
  return lines.join("\n");
}

try {
  const mod = await importGltfTransform();
  const loaded = await loadInput(input);
  const io = createIO(mod);
  const document = await readDocument(io, loaded);
  const report = analyze(document, loaded);
  console.log(asJson ? JSON.stringify(report, null, 2) : formatReport(report));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
