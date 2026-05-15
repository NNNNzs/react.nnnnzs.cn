/**
 * API 接口注册表
 *
 * 统一声明 API 接口配置，用于：
 * 1. API 权限检查
 * 2. MCP 工具自动注册
 * 3. 管理界面配置
 *
 * 这里是 Source of Truth（代码侧），数据库中的配置应与此保持同步。
 * 新增/修改接口时，先在这里声明，然后通过 seed 脚本同步到数据库。
 */

import type { AuthUser } from '@/types/auth';
import { POST_CREATE, POST_EDIT, POST_DELETE, POST_VIEW, COLLECTION_CREATE, COLLECTION_EDIT, COLLECTION_DELETE, CONFIG_EDIT } from '@/constants/permissions';

/** MCP 工具调用的 handler 类型 */
export type McpHandler = (
  args: Record<string, unknown>,
  user: AuthUser,
) => Promise<unknown>;

/** 接口注册表条目 */
export interface ApiRegistryEntry {
  /** 接口编码（唯一标识） */
  code: string;
  /** 接口名称 */
  name: string;
  /** 详细描述（同时作为 MCP 工具描述） */
  description?: string;
  /** 所属模块 */
  module: string;
  /** API 路径模式 */
  apiPath: string;
  /** HTTP 方法 */
  apiMethod: string;
  /** 是否暴露为 MCP 工具 */
  mcpEnabled: boolean;
  /** MCP 工具名（为空则自动生成） */
  mcpToolName?: string;
  /** 关联权限码 */
  permissionCode?: string;
  /** 输入参数 JSON Schema（用于 MCP inputSchema） */
  inputSchema?: Record<string, unknown>;
  /** 缓存失效标签 */
  cacheTags?: string[];
  /** MCP 工具的处理函数，直接引用 service 层方法 */
  handler?: McpHandler;
  /** 数据权限检查时，从资源中提取 owner_id 的函数 */
  getOwnerId?: (resource: unknown) => number | undefined;
}

/**
 * 接口注册表声明
 *
 * 这里是 Source of Truth（代码侧），数据库中的配置应与此保持同步。
 * 新增/修改接口时，先在这里声明，然后通过 seed 脚本同步到数据库。
 */
export const API_REGISTRY: ApiRegistryEntry[] = [
  // ---- 文章模块 ----
  {
    code: 'post_create',
    name: '创建文章',
    description: '创建新博客文章，支持标签、合集、分类等。先读取 blog://tags 和 blog://collections 资源了解现有标签和合集。',
    module: 'post',
    apiPath: '/api/post/create',
    apiMethod: 'POST',
    mcpEnabled: true,
    mcpToolName: 'create_article',
    permissionCode: POST_CREATE,
    cacheTags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '文章标题' },
        content: { type: 'string', description: '文章内容（Markdown）' },
        category: { type: 'string', description: '分类' },
        tags: { type: 'string', description: '逗号分隔的标签' },
        collections: { type: 'string', description: '逗号分隔的合集ID或slug' },
        description: { type: 'string', description: '简短描述' },
        cover: { type: 'string', description: '封面图URL' },
        hide: { type: 'string', description: '1隐藏 0显示' },
      },
      required: ['title', 'content'],
    },
    handler: async (args, user) => {
      const { createPost } = await import('@/services/post');
      return createPost({ ...args, created_by: user.id });
    },
  },
  {
    code: 'post_update',
    name: '更新文章',
    module: 'post',
    apiPath: '/api/post/[id]',
    apiMethod: 'PUT',
    mcpEnabled: true,
    mcpToolName: 'update_article',
    permissionCode: POST_EDIT,
    cacheTags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '文章ID' },
        title: { type: 'string', description: '文章标题' },
        content: { type: 'string', description: '文章内容（Markdown）' },
        category: { type: 'string', description: '分类' },
        tags: { type: 'string', description: '逗号分隔的标签' },
        description: { type: 'string', description: '简短描述' },
        cover: { type: 'string', description: '封面图URL' },
        hide: { type: 'string', description: '1隐藏 0显示' },
        add_to_collections: { type: 'string', description: '添加到的合集ID或slug，逗号分隔' },
        remove_from_collections: { type: 'string', description: '移除的合集ID或slug，逗号分隔' },
      },
      required: ['id'],
    },
    handler: async (args) => {
      const { updatePost } = await import('@/services/post');
      return updatePost(args.id as number, args);
    },
    getOwnerId: (resource) => (resource as { created_by?: number })?.created_by,
  },
  {
    code: 'post_delete',
    name: '删除文章',
    module: 'post',
    apiPath: '/api/post/[id]',
    apiMethod: 'DELETE',
    mcpEnabled: true,
    mcpToolName: 'delete_article',
    permissionCode: POST_DELETE,
    cacheTags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '文章ID' },
      },
      required: ['id'],
    },
    handler: async (args) => {
      const { getPostById, deletePost } = await import('@/services/post');
      const post = await getPostById(args.id as number);
      const success = await deletePost(args.id as number);
      return { success, post };
    },
    getOwnerId: (resource) => (resource as { post?: { created_by?: number } })?.post?.created_by,
  },
  {
    code: 'post_get',
    name: '获取文章',
    module: 'post',
    apiPath: '/api/post/[id]',
    apiMethod: 'GET',
    mcpEnabled: true,
    mcpToolName: 'get_article',
    permissionCode: POST_VIEW,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '文章ID' },
        title: { type: 'string', description: '文章标题（ID和标题二选一）' },
      },
    },
    handler: async (args) => {
      const { getPostById, getPostByTitle } = await import('@/services/post');
      if (args.id) return getPostById(args.id as number);
      if (args.title) return getPostByTitle(args.title as string);
      return null;
    },
  },
  {
    code: 'post_list',
    name: '文章列表',
    module: 'post',
    apiPath: '/api/post/list',
    apiMethod: 'GET',
    mcpEnabled: true,
    mcpToolName: 'list_articles',
    permissionCode: POST_VIEW,
    inputSchema: {
      type: 'object',
      properties: {
        pageNum: { type: 'number', description: '页码（默认1）' },
        pageSize: { type: 'number', description: '每页数量（默认10）' },
        keyword: { type: 'string', description: '搜索关键词' },
        hide: { type: 'string', description: '可见性过滤' },
      },
    },
    handler: async (args) => {
      const { getPostList } = await import('@/services/post');
      return getPostList({
        pageNum: (args.pageNum as number) ?? 1,
        pageSize: (args.pageSize as number) ?? 10,
        query: args.keyword as string | undefined,
        hide: args.hide as string | undefined,
      });
    },
  },
  // ---- 合集模块（仅 API，不暴露 MCP）----
  {
    code: 'collection_create',
    name: '创建合集',
    module: 'collection',
    apiPath: '/api/collection/create',
    apiMethod: 'POST',
    mcpEnabled: false,
    permissionCode: COLLECTION_CREATE,
  },
  {
    code: 'collection_update',
    name: '编辑合集',
    module: 'collection',
    apiPath: '/api/collection/[id]',
    apiMethod: 'PUT',
    mcpEnabled: false,
    permissionCode: COLLECTION_EDIT,
  },
  {
    code: 'collection_delete',
    name: '删除合集',
    module: 'collection',
    apiPath: '/api/collection/[id]',
    apiMethod: 'DELETE',
    mcpEnabled: false,
    permissionCode: COLLECTION_DELETE,
  },
  // ---- 配置模块 ----
  {
    code: 'config_update',
    name: '修改配置',
    module: 'config',
    apiPath: '/api/config/[key]',
    apiMethod: 'PUT',
    mcpEnabled: false,
    permissionCode: CONFIG_EDIT,
  },
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
  const key = `${entry.apiMethod}:${entry.apiPath}`;

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
    if (entry.apiMethod !== method) continue;
    if (matchRoutePattern(entry.apiPath, pathname)) {
      return entry;
    }
  }
  return null;
}

/** 获取所有启用了 MCP 的接口 */
export function getMcpEnabledEntries(): ApiRegistryEntry[] {
  return API_REGISTRY.filter(e => e.mcpEnabled);
}

/** 根据 MCP 工具名查找接口配置 */
export function getEntryByMcpToolName(toolName: string): ApiRegistryEntry | undefined {
  return registryByMcpTool.get(toolName);
}

/** 根据接口编码查找接口配置 */
export function getEntryByCode(code: string): ApiRegistryEntry | undefined {
  return API_REGISTRY.find(e => e.code === code);
}
