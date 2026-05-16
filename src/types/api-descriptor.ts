/**
 * API 接口自描述类型定义
 *
 * 用于 route.ts 文件导出接口元数据，实现：
 * 1. sync:api-registry 脚本自动扫描同步到数据库
 * 2. MCP 工具自动注册（需在 api-registry.ts 中配置 handler）
 * 3. 权限配置管理
 */

/** HTTP 方法 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** 接口自描述信息 */
export interface ApiDescriptor {
  /** 接口编码（唯一标识），格式：{module}_{action}，如 post_create */
  code: string;
  /** 接口名称（中文） */
  name: string;
  /** 详细描述（同时作为 MCP 工具描述） */
  description?: string;
  /** 所属模块：post, collection, config, user, admin 等 */
  module: string;
  /** HTTP 方法 */
  method: HttpMethod;
  /** 关联权限码（来自 constants/permissions.ts），为空表示公开接口 */
  permissionCode?: string;
  /** 输入参数 JSON Schema（用于 MCP inputSchema） */
  inputSchema?: Record<string, unknown>;
  /** 缓存失效标签 */
  cacheTags?: string[];
}
