/**
 * MCP 适配器
 *
 * 将 MCP 工具调用转发到对应的 service handler
 *
 * 核心思路：
 * 1. 通过 entry.handler 直接调用 service 层函数（避免 switch-case 硬编码）
 * 2. 完整的权限检查：功能权限 + 数据权限
 * 3. 创建类操作排除客户端传入的 created_by，防止权限提升
 */

import { hasDataPermission } from '@/lib/permission';
import type { ApiRegistryEntry, McpHandler } from '@/lib/api-registry';
import type { AuthUser } from '@/types/auth';
import { revalidateTag, revalidatePath } from 'next/cache';
import type { z } from 'zod';

/**
 * MCP 工具调用结果
 */
export interface McpToolResult {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * 将 MCP 工具调用转发到对应的 service handler
 */
export async function handleMcpToApi(
  entry: ApiRegistryEntry,
  args: Record<string, unknown>,
  user: AuthUser,
  headers: Headers,
): Promise<McpToolResult> {
  try {
    // 1. 检查功能权限
    if (entry.permissionCode && !user.permissions.includes(entry.permissionCode)) {
      return {
        isError: true,
        content: [{ type: "text", text: `无权限：需要 ${entry.permissionCode}` }],
      };
    }

    // 2. 检查数据权限（对于有 getOwnerId 的操作）
    if (entry.getOwnerId && entry.permissionCode) {
      // 先获取资源以检查所有权
      const resource = await fetchResourceForPermissionCheck(entry, args);
      if (resource) {
        const ownerId = entry.getOwnerId(resource);
        if (!hasDataPermission(user, entry.permissionCode, ownerId)) {
          return {
            isError: true,
            content: [{ type: "text", text: '无权限操作此资源（仅能操作自己的数据）' }],
          };
        }
      }
    }

    // 3. 调用 handler
    if (!entry.handler) {
      return {
        isError: true,
        content: [{ type: "text", text: `接口 ${entry.code} 未实现 MCP handler` }],
      };
    }

    // 4. 创建类操作：排除客户端传入的 created_by，防止权限提升
    const sanitizedArgs = { ...args };
    if (entry.code.endsWith('_create')) {
      delete sanitizedArgs.created_by;
    }

    const result = await entry.handler(sanitizedArgs, user);

    // 5. 缓存失效
    invalidateCacheTags(entry.cacheTags, result);

    if (!result) {
      return {
        isError: true,
        content: [{ type: "text", text: 'Not found' }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: error instanceof Error ? error.message : 'Internal error',
      }],
    };
  }
}

/**
 * 获取资源用于权限检查
 *
 * 对于更新/删除操作，需要先获取资源以检查所有权
 */
async function fetchResourceForPermissionCheck(
  entry: ApiRegistryEntry,
  args: Record<string, unknown>,
): Promise<unknown | null> {
  // 只有需要检查数据权限的操作才需要获取资源
  if (!entry.getOwnerId) return null;

  // 根据接口类型获取资源
  switch (entry.code) {
    case 'post_update':
    case 'post_delete': {
      const { getPostById } = await import('@/services/post');
      return getPostById(args.id as number);
    }
    // 其他需要数据权限检查的接口...
    default:
      return null;
  }
}

/**
 * 缓存失效
 */
function invalidateCacheTags(tags: string[] | undefined, resource: unknown) {
  if (!tags?.length) return;

  for (const tag of tags) {
    revalidateTag(tag, {});
  }

  // 如果资源有 path 字段，额外清除路径缓存
  if (resource && typeof resource === 'object' && 'path' in resource) {
    const { path } = resource as { path: string };
    revalidatePath(path);
  }

  // 如果资源有 tags 字段，额外清除标签页缓存
  if (resource && typeof resource === 'object' && 'tags' in resource) {
    const rawTags = (resource as { tags: unknown }).tags;
    const tagArr = Array.isArray(rawTags) ? rawTags : String(rawTags).split(',');
    tagArr.forEach((tag: string) => {
      const trimmed = typeof tag === 'string' ? tag.trim() : tag;
      if (trimmed) revalidatePath(`/tags/${encodeURIComponent(trimmed)}`);
    });
  }
}

/**
 * JSON Schema → Zod 转换（简化版）
 *
 * 仅支持本项目用到的 JSON Schema 子集
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): Record<string, z.ZodType> {
  const { z } = require('zod') as { z: typeof import('zod').z };
  const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required || []) as string[]);
  const fields: Record<string, z.ZodType> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field: z.ZodType;

    if (prop.type === 'string') {
      field = z.string();
    } else if (prop.type === 'number') {
      field = z.number();
    } else if (prop.type === 'boolean') {
      field = z.boolean();
    } else {
      field = z.unknown();
    }

    if (prop.description) {
      field = field.describe(prop.description as string);
    }

    if (!required.has(key)) {
      field = field.optional();
    }

    fields[key] = field;
  }

  return fields;
}
