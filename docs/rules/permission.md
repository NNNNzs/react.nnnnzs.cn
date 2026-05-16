# 权限系统开发规范

> **本文档定位**: 开发者操作手册 - 说明如何正确实现权限检查
>
> 本规范定义了项目中所有 API 的权限验证标准，所有开发人员必须严格遵守。
>
> **RBAC 设计文档**: [RBAC 可配置权限设计](../designs/rbac-config-design.md)

## 核心原则

### 1. 多层防护原则

权限检查必须在多个层面实现，确保没有任何单点故障：

```
Layer 1: 前端 UI 控制（用户体验）
   ├─ 动态菜单生成（基于权限码）
   ├─ 按钮显隐控制
   └─ 路由访问拦截
   ↓
Layer 2: API 权限验证（核心防护）✅ 必须实现
   ├─ 身份验证（Token）
   ├─ 功能权限检查（权限码）
   ├─ 数据权限检查（data_scope: self/all）
   └─ 操作类型检查
   ↓
Layer 3: 服务层过滤（最后一道防线）
   ├─ 查询条件过滤
   └─ 数据返回控制
```

**关键原则**：前端控制只负责用户体验，真正的权限验证必须在 API 层完成。

### 2. 防御性编程原则

- ✅ **永远不信任客户端请求**：角色、用户ID等必须从服务端 Token 中验证
- ✅ **默认拒绝**：除非明确授权，否则拒绝访问
- ✅ **最小权限**：用户只能访问其职责范围内的最小权限集合
- ❌ **不信任前端隐藏**：前端隐藏的功能不代表有权限保护

## 权限模型

### 数据库表结构

| 表名 | 说明 |
|------|------|
| `tb_role` | 角色表 |
| `tb_permission` | 权限码表 |
| `tb_role_permission` | 角色-权限关联（含 data_scope） |
| `tb_user_role` | 用户-角色关联 |
| `tb_api_registry` | API 接口注册表 |

### 权限码规范

权限码格式：`{module}:{action}`，统一定义在 `src/constants/permissions.ts`。

| 模块 | 权限码 | 说明 |
|------|--------|------|
| **文章** | `post:view` | 查看文章 |
| | `post:create` | 创建文章 |
| | `post:edit` | 编辑文章 |
| | `post:delete` | 删除文章 |
| | `post:restore` | 恢复文章 |
| | `post:hide` | 隐藏文章 |
| | `post:view_deleted` | 查看回收站 |
| **评论** | `comment:manage` | 管理评论 |
| **合集** | `collection:view` | 查看合集 |
| | `collection:create` | 创建合集 |
| | `collection:edit` | 编辑合集 |
| | `collection:delete` | 删除合集 |
| **配置** | `config:view` | 查看配置 |
| | `config:edit` | 修改配置 |
| **用户** | `user:view` | 查看用户 |
| | `user:manage` | 管理用户 |
| | `user:role:assign` | 分配角色 |
| **工具** | `queue:view` | 队列监控 |
| | `vector:view` | 向量检索 |
| | `tts:view` | 语音合成 |
| | `image:view` | AI 图片生成 |

### 数据权限（data_scope）

每个角色-权限关联都有 `data_scope` 字段：

| 值 | 说明 | 示例 |
|----|------|------|
| `all` | 可操作所有数据 | 管理员编辑所有文章 |
| `self` | 仅可操作自己的数据 | 普通用户编辑自己的文章 |

### 内置角色

| 角色 | 说明 | 默认权限 |
|------|------|----------|
| `admin` | 管理员 | 全部 21 个权限码，data_scope=all |
| `user` | 普通用户 | post:view/create/edit/hide，data_scope=self |

> 内置角色的权限可通过 `/c/roles` 管理页面修改，但不允许删除。

## API 权限实现标准

### 推荐方式：requirePermission（一步到位）

```typescript
import { requirePermission } from '@/lib/permission';
import { COLLECTION_CREATE } from '@/constants/permissions';

export async function POST(request: NextRequest) {
  // 一步完成身份验证 + 功能权限检查
  const check = await requirePermission(request, COLLECTION_CREATE);
  if ('error' in check) {
    return NextResponse.json(errorResponse(check.error), { status: check.status });
  }

  const { user } = check;
  // 业务逻辑...
}
```

### 数据权限检查

当需要限制用户只能操作自己的数据时，配合 `hasDataPermission`：

```typescript
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { POST_EDIT } from '@/constants/permissions';

export async function PUT(request: NextRequest) {
  const check = await requirePermission(request, POST_EDIT);
  if ('error' in check) {
    return NextResponse.json(errorResponse(check.error), { status: check.status });
  }

  const { user } = check;
  const post = await getPostById(id);

  // 数据权限检查：普通用户只能编辑自己的文章
  if (!hasDataPermission(user, POST_EDIT, post.created_by)) {
    return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
  }

  // 业务逻辑...
}
```

### 仅需认证（不限权限）

```typescript
import { requireAuth } from '@/lib/permission';

export async function GET(request: NextRequest) {
  const check = await requireAuth(request);
  if ('error' in check) {
    return NextResponse.json(errorResponse(check.error), { status: check.status });
  }

  const { user } = check;
  // 业务逻辑...
}
```

### 公开接口（无需认证）

公开接口不需要调用任何权限函数，直接处理业务逻辑即可：

```typescript
export async function GET(request: NextRequest) {
  const posts = await getPostList({ is_delete: 0, hide: '0' });
  return NextResponse.json(successResponse(posts));
}
```

### 条件性认证

某些接口在特定条件下需要认证（如查看隐藏文章）：

```typescript
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasPermissionCode } from '@/lib/permission';
import { POST_VIEW_DELETED } from '@/constants/permissions';

export async function GET(request: NextRequest) {
  const isDelete = searchParams.get('is_delete');

  // 仅当查询已删除文章时才检查权限
  if (isDelete === '1') {
    const user = await getAuthUserFromRequest(request.headers);
    if (!user || !hasPermissionCode(user, POST_VIEW_DELETED)) {
      return NextResponse.json(errorResponse('无权限'), { status: 403 });
    }
  }

  // 业务逻辑...
}
```

## 权限工具库

### 文件结构

| 文件 | 用途 |
|------|------|
| `src/constants/permissions.ts` | 权限码常量定义（**唯一来源**） |
| `src/lib/permission.ts` | 权限检查函数 |
| `src/services/permission.ts` | 权限查询服务（数据库） |
| `src/types/api-descriptor.ts` | API 接口自描述类型定义 |
| `src/lib/api-registry.ts` | API 接口注册表（运行时） |
| `src/lib/mcp-adapter.ts` | MCP 适配器（权限检查） |
| `scripts/sync-api-registry.ts` | 接口扫描同步脚本 |

### API 接口自描述

每个 `route.ts` 文件应导出 `descriptor` 常量，定义接口元数据：

```typescript
import type { ApiDescriptor } from '@/types/api-descriptor';
import { POST_CREATE } from '@/constants/permissions';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'post_create',
  name: '创建文章',
  description: '创建新博客文章',
  module: 'post',
  method: 'POST',
  permissionCode: POST_CREATE,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '文章标题' },
      content: { type: 'string', description: '文章内容' },
    },
    required: ['title', 'content'],
  },
};
```

一个文件有多个接口时，使用 `xxxDescriptor` 命名：

```typescript
export const getDescriptor: ApiDescriptor = { /* GET 接口 */ };
export const updateDescriptor: ApiDescriptor = { /* PUT 接口 */ };
export const deleteDescriptor: ApiDescriptor = { /* DELETE 接口 */ };
```

### 同步脚本

使用 `pnpm sync:api-registry` 扫描所有 route.ts 并同步到数据库 `tb_api_registry` 表。

脚本通过动态 import 读取每个文件的 descriptor 导出，支持：
- 权限码常量自动解析
- 多 descriptor 导出（xxxDescriptor 模式）
- 自动禁用已删除的接口

### 核心函数

#### `requirePermission(request, code)`
身份验证 + 功能权限检查，推荐用于所有需要权限的 API。

#### `requireAuth(request)`
仅身份验证，不限制权限。

#### `hasPermissionCode(user, code)`
检查用户是否有指定权限码。

#### `hasDataPermission(user, code, resourceOwnerId?)`
检查用户是否有指定权限码 + 数据权限。

#### `getAuthUserFromRequest(headers)`
从请求中获取已认证用户信息（含权限），不强制要求认证。

## 前端权限控制

### AuthContext

```typescript
const { hasPermission, hasDataPermission } = useAuth();

// 功能权限
if (hasPermission(COLLECTION_CREATE)) {
  // 显示创建按钮
}

// 数据权限
if (hasDataPermission(POST_EDIT, post.created_by)) {
  // 显示编辑按钮
}
```

### 管理后台菜单

菜单项在 `src/app/c/layout.tsx` 中基于权限码动态生成：

```typescript
if (hasPermission(COLLECTION_VIEW)) {
  items.push({ key: "/c/collections", label: "合集管理" });
}
```

### 管理后台页面

| 路由 | 说明 | 权限 |
|------|------|------|
| `/c/roles` | 角色管理 | `user:manage` |
| `/c/permissions` | 权限管理 | `user:view` |

## HTTP 状态码规范

| 状态码 | 场景 | 示例消息 |
|--------|------|----------|
| **200** | 操作成功 | 更新成功、删除成功 |
| **400** | 请求参数错误 | pageSize 超出范围、无效的 ID |
| **401** | 未登录或 Token 无效 | 未授权、登录已过期 |
| **403** | 已登录但权限不足 | 无权限访问、无权限编辑此文章 |
| **404** | 资源不存在 | 文章不存在、用户不存在 |
| **500** | 服务器内部错误 | 数据库连接失败 |

## 开发检查清单

在开发新的 API 时，请按照以下清单检查：

- [ ] 是否在 `src/constants/permissions.ts` 中定义了权限码？
- [ ] 是否使用 `requirePermission` 进行权限检查？
- [ ] 是否使用权限码常量而非魔法字符串？
- [ ] 需要数据权限时是否使用了 `hasDataPermission`？
- [ ] 公开接口是否跳过了权限检查？
- [ ] 是否返回了正确的 HTTP 状态码？
- [ ] 是否在 `src/lib/api-registry.ts` 中注册了接口？

## 相关文档

- **RBAC 设计文档**: [docs/designs/rbac-config-design.md](../designs/rbac-config-design.md)
- **权限码常量**: `src/constants/permissions.ts`
- **权限检查函数**: `src/lib/permission.ts`
- **权限查询服务**: `src/services/permission.ts`
