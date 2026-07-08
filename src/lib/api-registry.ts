/**
 * API 接口注册表
 *
 * 统一声明 API 接口配置，用于：
 * 1. API 权限检查
 * 2. MCP 工具自动注册
 * 3. 管理界面配置
 *
 * 元数据的 Source of Truth 是各 route.ts 导出的 descriptor。
 * 本文件仅补充 MCP 专属字段（handler、mcpToolName、getOwnerId、apiPath）。
 * 新增/修改接口时，先修改对应 route.ts 的 descriptor，再通过 seed 脚本同步到数据库。
 */

import type { AuthUser } from '@/types/auth';
import { CONFIG_EDIT, FILE_UPLOAD } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

// ---- 从 route.ts 导入 descriptor（元数据 Source of Truth）----
import { descriptor as postCreateRoute } from '@/app/api/post/create/route';
import { getDescriptor as postGetRoute, updateDescriptor as postUpdateRoute, deleteDescriptor as postDeleteRoute } from '@/app/api/post/[id]/route';
import { descriptor as postListRoute } from '@/app/api/post/list/route';
import { descriptor as imageGenRoute } from '@/app/api/image-gen/route';
import { descriptor as imageEditRoute } from '@/app/api/image-gen/edit/route';
import { descriptor as ttsSynthesizeRoute } from '@/app/api/tts/synthesize/route';
import { descriptor as collectionCreateRoute } from '@/app/api/collection/create/route';
import { updateDescriptor as collectionUpdateRoute, deleteDescriptor as collectionDeleteRoute } from '@/app/api/collection/[id]/route';
import { descriptor as uploadRoute } from '@/app/api/fs/upload/route';
import { getDescriptor as aiProvidersGet, createDescriptor as aiProvidersCreate } from '@/app/api/config/ai/providers/route';
import { updateDescriptor as aiProviderUpdate, deleteDescriptor as aiProviderDelete } from '@/app/api/config/ai/providers/[id]/route';
import { descriptor as aiProviderFetchModels } from '@/app/api/config/ai/providers/[id]/fetch-models/route';
import { getDescriptor as aiBindingsGet, updateDescriptor as aiBindingsUpdate } from '@/app/api/config/ai/bindings/route';
import { descriptor as aiBindingActivate } from '@/app/api/config/ai/bindings/[id]/activate/route';
import { deleteDescriptor as aiBindingDelete } from '@/app/api/config/ai/bindings/[id]/route';
import { getDescriptor as aiScenariosGet, createDescriptor as aiScenarioCreate } from '@/app/api/config/ai/scenarios/route';

/** MCP 工具调用的 handler 类型 */
export type McpHandler = (
  args: Record<string, unknown>,
  user: AuthUser,
) => Promise<unknown>;

/** 接口注册表条目（继承 ApiDescriptor，仅补充运行时字段） */
export interface ApiRegistryEntry extends ApiDescriptor {
  /** API 路径模式 */
  apiPath: string;
  /** 是否暴露为 MCP 工具 */
  mcpEnabled: boolean;
  /** MCP 工具名（为空则自动生成） */
  mcpToolName?: string;
  /** MCP 工具的处理函数，直接引用 service 层方法 */
  handler?: McpHandler;
  /** 数据权限检查时，从资源中提取 owner_id 的函数 */
  getOwnerId?: (resource: unknown) => number | undefined;
}

/**
 * 接口注册表声明
 *
 * 元数据来自 route.ts descriptor，本文件仅补充 MCP 专属字段。
 */
export const API_REGISTRY: ApiRegistryEntry[] = [
  // ---- 文章模块 ----
  {
    ...postCreateRoute,
    apiPath: '/api/post/create',
    mcpEnabled: true,
    mcpToolName: 'create_article',
    handler: async (args, user) => {
      const { createPost } = await import('@/services/post');
      const { addPostsToCollection, getCollectionBySlug } = await import('@/services/collection');
      const { collections, ...postArgs } = args;

      const post = await createPost({ ...postArgs, created_by: user.id });

      if (collections) {
        const tokens = String(collections).split(',').map(s => s.trim()).filter(Boolean);
        for (const token of tokens) {
          const num = Number(token);
          const collectionId = !isNaN(num)
            ? num
            : (await getCollectionBySlug(token))?.id;

          if (collectionId) {
            await addPostsToCollection(collectionId, [post.id], undefined, user.id);
          }
        }
      }

      return post;
    },
  },
  {
    ...postUpdateRoute,
    apiPath: '/api/post/[id]',
    mcpEnabled: true,
    mcpToolName: 'update_article',
    handler: async (args, user) => {
      const { updatePost } = await import('@/services/post');
      const { addPostsToCollection, removePostsFromCollection, getCollectionBySlug } = await import('@/services/collection');
      const postId = args.id as number;

      // 提取合集操作参数，不传给 updatePost
      const { add_to_collections, remove_from_collections, ...postArgs } = args;

      // 解析合集标识（支持 slug 或 ID）为数字 ID
      const resolveCollectionIds = async (raw: string | undefined): Promise<number[]> => {
        if (!raw) return [];
        const tokens = String(raw).split(',').map(s => s.trim()).filter(Boolean);
        const ids: number[] = [];
        for (const token of tokens) {
          const num = Number(token);
          if (!isNaN(num)) {
            ids.push(num);
          } else {
            // 尝试按 slug 查找
            const col = await getCollectionBySlug(token);
            if (col) ids.push(col.id);
          }
        }
        return ids;
      };

      // 处理添加到合集
      if (add_to_collections) {
        const colIds = await resolveCollectionIds(add_to_collections as string);
        for (const colId of colIds) {
          await addPostsToCollection(colId, [postId], undefined, user.id);
        }
      }

      // 处理从合集移除
      if (remove_from_collections) {
        const colIds = await resolveCollectionIds(remove_from_collections as string);
        for (const colId of colIds) {
          await removePostsFromCollection(colId, [postId], user.id);
        }
      }

      return updatePost(postId, postArgs, user.id);
    },
    getOwnerId: (resource) => (resource as { created_by?: number })?.created_by,
  },
  {
    ...postDeleteRoute,
    apiPath: '/api/post/[id]',
    mcpEnabled: true,
    mcpToolName: 'delete_article',
    handler: async (args) => {
      const { getPostById, deletePost } = await import('@/services/post');
      const post = await getPostById(args.id as number);
      const success = await deletePost(args.id as number);
      return { success, post };
    },
    getOwnerId: (resource) => (resource as { post?: { created_by?: number } })?.post?.created_by,
  },
  {
    ...postGetRoute,
    apiPath: '/api/post/[id]',
    mcpEnabled: true,
    mcpToolName: 'get_article',
    handler: async (args) => {
      const { getPostById, getPostByTitle } = await import('@/services/post');
      const { getCollectionsByPostId } = await import('@/services/collection');
      let post = null;
      if (args.id) post = await getPostById(args.id as number);
      if (args.title) post = await getPostByTitle(args.title as string);
      if (post) {
        return { ...post, collections: await getCollectionsByPostId(post.id) };
      }
      return null;
    },
  },
  {
    ...postListRoute,
    apiPath: '/api/post/list',
    mcpEnabled: true,
    mcpToolName: 'list_articles',
    handler: async (args) => {
      const { getPostList } = await import('@/services/post');
      const { getCollectionsByPostId } = await import('@/services/collection');
      const result = await getPostList({
        pageNum: (args.pageNum as number) ?? 1,
        pageSize: (args.pageSize as number) ?? 10,
        query: args.keyword as string | undefined,
        hide: args.hide as string | undefined,
      });
      // 批量查询文章合集信息
      const postIds = result.record.map(p => p.id);
      const colMap: Record<number, unknown[]> = {};
      if (postIds.length > 0) {
        const colPromises = postIds.map(async (id) => {
          colMap[id] = await getCollectionsByPostId(id);
        });
        await Promise.all(colPromises);
      }
      return {
        ...result,
        record: result.record.map(p => ({
          ...p,
          collections: colMap[p.id] || [],
        })),
      };
    },
  },
  // ---- 图片生成模块 ----
  {
    ...imageGenRoute,
    apiPath: '/api/image-gen',
    mcpEnabled: true,
    mcpToolName: 'generate_image',
    description: '创建 AI 图片生成异步任务(文生图)，立即返回 jobId、预分配 CDN URL 和 MCP resourceUri；通过 resourceUri 查询任务状态。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述提示词' },
        size: { type: 'string', description: '图片尺寸，如 1024x1024' },
        quality: { type: 'string', description: '图片质量: low、medium、high 或 auto' },
      },
      required: ['prompt'],
    },
    handler: async (args, user) => {
      const { createImageGenerationJob } = await import('@/services/image-gen-job');
      return createImageGenerationJob({
        options: {
          mode: 'generate',
          prompt: args.prompt as string,
          size: args.size as string | undefined,
          quality: args.quality as string | undefined,
        },
        userId: user.id,
        source: 'MCP',
      });
    },
  },
  {
    ...imageEditRoute,
    apiPath: '/api/image-gen/edit',
    mcpEnabled: true,
    mcpToolName: 'edit_image',
    description: '创建 AI 图片编辑异步任务，支持一张或多张参考图片；立即返回 jobId、预分配 CDN URL 和 MCP resourceUri；通过 resourceUri 查询任务状态。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片编辑指令' },
        image: { type: 'string', description: '单张参考图片 URL（兼容旧客户端）' },
        images: {
          type: 'array',
          items: { type: 'string' },
          description: '参考图片 URL 列表，支持多图编辑',
        },
        size: { type: 'string', description: '图片尺寸，如 1024x1024' },
        quality: { type: 'string', description: '图片质量: low、medium、high 或 auto' },
      },
      required: ['prompt'],
    },
    handler: async (args, user) => {
      const { createImageGenerationJob } = await import('@/services/image-gen-job');
      const rawImages = Array.isArray(args.images)
        ? args.images.filter((item): item is string => typeof item === 'string')
        : undefined;

      return createImageGenerationJob({
        options: {
          mode: 'edit',
          prompt: args.prompt as string,
          image: args.image as string | undefined,
          images: rawImages,
          size: args.size as string | undefined,
          quality: args.quality as string | undefined,
        },
        userId: user.id,
        source: 'MCP',
      });
    },
  },
  // ---- TTS 语音合成模块 ----
  {
    ...ttsSynthesizeRoute,
    apiPath: '/api/tts/synthesize',
    mcpEnabled: true,
    mcpToolName: 'synthesize_speech',
    description: '创建 TTS 语音合成异步任务，立即返回 jobId、预分配 CDN URL 和 MCP resourceUri；通过 resourceUri 轮询任务状态，ready 后取 audioUrl 播放/下载。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要合成的文本（必填）' },
        model: { type: 'string', description: 'TTS 模型，如 mimo-v2.5-tts（默认取系统配置）' },
        voice: { type: 'string', description: '音色名称，如 冰糖/茉莉（默认取系统配置）' },
        instruction: { type: 'string', description: '风格指令（可选）' },
      },
      required: ['text'],
    },
    handler: async (args, user) => {
      const { createTTSJob } = await import('@/services/tts-job');
      return createTTSJob({
        options: {
          text: args.text as string,
          model: args.model as string | undefined,
          voice: args.voice as string | undefined,
          instruction: args.instruction as string | undefined,
        },
        userId: user.id,
        source: 'MCP',
      });
    },
  },
  // ---- 图片上传模块（MCP 可用）----
  {
    ...uploadRoute,
    apiPath: '/api/fs/upload',
    mcpEnabled: true,
    mcpToolName: 'upload_file',
    permissionCode: FILE_UPLOAD,
    handler: async (args) => {
      const { base64ToBuffer, downloadFileFromUrl, normalizeCosKey, uploadFileToCOS } = await import('@/services/file-upload');
      const filename = (args.filename as string | undefined) || 'attachment.bin';
      const key = (args.key || args.cosKey) as string | undefined;

      if (args.url) {
        const downloadedFile = await downloadFileFromUrl(args.url as string, args.filename as string | undefined);
        const url = await uploadFileToCOS({
          ...downloadedFile,
          ext: args.ext as string | undefined,
          key,
        });
        return { url, ...(key ? { key: normalizeCosKey(key) } : {}) };
      }

      if (!args.base64) {
        throw new Error('缺少文件内容：请传 base64 或 url');
      }

      const url = await uploadFileToCOS({
        buffer: base64ToBuffer(args.base64 as string),
        filename,
        mimetype: args.mimeType as string | undefined,
        ext: args.ext as string | undefined,
        key,
      });
      return { url, ...(key ? { key: normalizeCosKey(key) } : {}) };
    },
  },
  // ---- 合集模块（仅 API，不暴露 MCP）----
  {
    ...collectionCreateRoute,
    apiPath: '/api/collection/create',
    mcpEnabled: false,
  },
  {
    ...collectionUpdateRoute,
    apiPath: '/api/collection/[id]',
    mcpEnabled: false,
  },
  {
    ...collectionDeleteRoute,
    apiPath: '/api/collection/[id]',
    mcpEnabled: false,
  },
  // ---- 配置模块（无 descriptor，保持内联）----
  {
    code: 'config_update',
    name: '修改配置',
    module: 'config',
    apiPath: '/api/config/[key]',
    method: 'PUT',
    mcpEnabled: false,
    permissionCode: CONFIG_EDIT,
  },
  // ---- AI 供应商管理 ----
  { ...aiProvidersGet, apiPath: '/api/config/ai/providers', mcpEnabled: false },
  { ...aiProvidersCreate, apiPath: '/api/config/ai/providers', mcpEnabled: false },
  { ...aiProviderUpdate, apiPath: '/api/config/ai/providers/[id]', mcpEnabled: false },
  { ...aiProviderDelete, apiPath: '/api/config/ai/providers/[id]', mcpEnabled: false },
  { ...aiProviderFetchModels, apiPath: '/api/config/ai/providers/[id]/fetch-models', mcpEnabled: false },
  // ---- AI 场景绑定 ----
  { ...aiBindingsGet, apiPath: '/api/config/ai/bindings', mcpEnabled: false },
  { ...aiBindingsUpdate, apiPath: '/api/config/ai/bindings', mcpEnabled: false },
  { ...aiBindingActivate, apiPath: '/api/config/ai/bindings/[id]/activate', mcpEnabled: false },
  { ...aiBindingDelete, apiPath: '/api/config/ai/bindings/[id]', mcpEnabled: false },
  // ---- AI 场景管理 ----
  { ...aiScenariosGet, apiPath: '/api/config/ai/scenarios', mcpEnabled: false },
  { ...aiScenarioCreate, apiPath: '/api/config/ai/scenarios', mcpEnabled: false },
];

// ============ 运行时查询 ============

/** 精确路径索引（静态路径，如 /api/post/list） */
const registryByPath: Map<string, ApiRegistryEntry> = new Map();
/** 模式路径列表（动态路径，如 /api/post/[id]） */
const registryByPattern: ApiRegistryEntry[] = [];
/** MCP 工具名索引 */
const registryByMcpTool: Map<string, ApiRegistryEntry> = new Map();

// 构建索引
for (const entry of API_REGISTRY) {
  const key = `${entry.method}:${entry.apiPath}`;

  // 区分精确路径和模式路径（含 [id] 等动态段）
  if (entry.apiPath.includes('[')) {
    registryByPattern.push(entry);
  } else {
    registryByPath.set(key, entry);
  }

  if (entry.mcpEnabled && entry.mcpToolName) {
    registryByMcpTool.set(entry.mcpToolName, entry);
  }
}

/**
 * 匹配路由模式
 *
 * 支持：
 * - /api/post/[id] 匹配 /api/post/123
 * - /api/post/[...path] 匹配 /api/post/a/b/c
 */
function matchRoutePattern(pattern: string, pathname: string): boolean {
  // 将模式转换为正则表达式
  const regexStr = pattern
    .replace(/\[([^\]]+)\]/g, (_, param) => {
      if (param.startsWith('...')) {
        // 捕获剩余所有路径
        return '(.+)';
      }
      // 捕获单个路径段
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(pathname);
}

/**
 * 根据请求路径和方法查找接口配置
 *
 * 匹配优先级：
 * 1. 精确匹配（静态路径，如 /api/post/list）
 * 2. 模式匹配（动态路径，如 /api/post/[id]）
 *
 * 注意：精确路径和模式路径不会冲突，因为：
 * - /api/post/list → 精确匹配
 * - /api/post/123 → 模式匹配 /api/post/[id]
 */
export function matchApiRegistry(pathname: string, method: string): ApiRegistryEntry | null {
  // 1. 精确匹配（O(1) 查找）
  const exact = registryByPath.get(`${method}:${pathname}`);
  if (exact) return exact;

  // 2. 模式匹配（遍历动态路径模式）
  for (const entry of registryByPattern) {
    if (entry.method !== method) continue;
    if (matchRoutePattern(entry.apiPath, pathname)) {
      return entry;
    }
  }
  return null;
}

/** 获取所有启用了 MCP 的接口（从数据库读取） */
export async function getMcpEnabledEntries(): Promise<ApiRegistryEntry[]> {
  const { prisma } = await import('@/lib/prisma');
  const dbEntries = await prisma.tbApiRegistry.findMany({
    where: { mcp_enabled: 1, status: 1 },
  });

  return dbEntries
    .map(db => {
      const codeEntry = API_REGISTRY.find(e => e.code === db.code);
      if (!codeEntry || !codeEntry.handler) {
        return null;
      }
      return {
        ...codeEntry,
        mcpEnabled: true,
        mcpToolName: db.mcp_tool_name || codeEntry.mcpToolName,
        permissionCode: db.permission_code || codeEntry.permissionCode,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

/** 根据 MCP 工具名查找接口配置 */
export function getEntryByMcpToolName(toolName: string): ApiRegistryEntry | undefined {
  return registryByMcpTool.get(toolName);
}

/** 根据接口编码查找接口配置 */
export function getEntryByCode(code: string): ApiRegistryEntry | undefined {
  return API_REGISTRY.find(e => e.code === code);
}
