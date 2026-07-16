# RBAC 迁移清单 — 现有权限与 MCP 接口盘点

> **📦 已归档** — 本文档是 RBAC 迁移时的参考清单，迁移已完成。保留供历史参考。
>
> **用途**: 配置化 RBAC 迁移时的对照清单，记录当前硬编码实现的完整现状
>
> **关联文档**: [配置化 RBAC 权限系统设计](rbac-config-design.md)（✅ 已实施）

## 目录

- [现有角色与权限](#现有角色与权限)
- [API 路由权限清单](#api-路由权限清单)
- [MCP 接口清单](#mcp-接口清单)
- [需注册到 api_registry 的接口](#需注册到-api_registry-的接口)
- [权限检查模式分析](#权限检查模式分析)
- [迁移注意事项](#迁移注意事项)

---

## 现有角色与权限

### 角色定义

**文件**: `src/types/role.ts`

| 角色 | 枚举值 | 说明 |
|------|--------|------|
| ADMIN | `'admin'` | 管理员 — 拥有所有权限 |
| USER | `'user'` | 普通用户 — 基本权限 |
| GUEST | `'guest'` | 游客 — 只读权限 |

### 权限字段映射

| 权限字段 | 说明 | ADMIN | USER | GUEST | 迁移后权限码 |
|----------|------|-------|------|-------|-------------|
| `canAccessConfig` | 配置管理 | ✅ | ❌ | ❌ | `config:view`, `config:edit` |
| `canAccessUserManagement` | 用户管理 | ✅ | ❌ | ❌ | `user:view`, `user:manage` |
| `canCreatePost` | 创建文章 | ✅ | ✅ | ❌ | `post:create` |
| `canEditPost` | 编辑文章 | ✅ | ✅ | ❌ | `post:edit` |
| `canDeletePost` | 删除文章 | ✅ | ❌ | ❌ | `post:delete` |
| `canManageComments` | 管理评论 | ✅ | ❌ | ❌ | `comment:manage` |

### 权限检查函数

**文件**: `src/lib/permission.ts`

| 函数 | 用途 | 迁移后替代方案 |
|------|------|---------------|
| `isAdmin(userRole)` | 检查是否管理员 | `hasPermission(user, 'xxx')` |
| `canAccessPost(user, post, op)` | 文章级权限 | `hasDataPermission(user, 'post:edit', post.created_by)` |
| `canViewHiddenPosts(user)` | 查看隐藏文章 | `hasPermission(user, 'post:view_hidden')` |
| `canViewAllPosts(user)` | 查看所有文章 | `hasPermission(user, 'post:view_deleted')` |
| `canAccessUser(user, targetId, op)` | 用户级权限 | `hasDataPermission(user, 'user:manage', targetId)` |
| `canManageConfig(user)` | 配置管理 | `hasPermission(user, 'config:edit')` |
| `canManageCollections(user)` | 合集管理 | `hasPermission(user, 'collection:create')` |
| `canManageUsers(user)` | 用户管理 | `hasPermission(user, 'user:manage')` |
| `requireAdmin(headers)` | 管理员中间件 | `requirePermission(request, 'xxx')` |
| `validateUserFromRequest(headers)` | 身份验证 | 保留，作为基础认证 |

---

## API 路由权限清单

### 文章模块 (Post)

| 路由 | 方法 | 当前权限检查 | 数据权限 | 迁移权限码 | data_scope |
|------|------|-------------|----------|-----------|------------|
| `/api/post/create` | POST | 仅登录验证 | — | `post:create` | `self` |
| `/api/post/[id]` | GET | 条件检查① | 是 | `post:view` | — |
| `/api/post/[id]` | PUT | `canAccessPost(edit)` | 是 | `post:edit` | `self/all` |
| `/api/post/[id]` | PATCH | `canAccessPost(edit)` | 是 | `post:edit` | `self/all` |
| `/api/post/[id]` | DELETE | `canAccessPost(delete)` | 是 | `post:delete` | `self/all` |
| `/api/post/list` | GET | 条件检查② | 是 | `post:view` | — |
| `/api/post/detail` | GET | 无 | — | 公开 | — |
| `/api/post/archives` | GET | 无 | — | 公开 | — |
| `/api/post/query` | GET | 无 | — | 公开 | — |
| `/api/post/tags` | GET | 无 | — | 公开 | — |
| `/api/post/tags/[tag]` | GET | 无 | — | 公开 | — |
| `/api/post/by-path/[...path]` | GET | 无 | — | 公开 | — |
| `/api/post/fav` | PUT | 仅登录验证 | — | `post:edit` | `self` |
| `/api/post/[id]/collections` | GET | 无 | — | 公开 | — |
| `/api/post/[id]/embed` | GET/POST | 无 | — | 公开 | — |
| `/api/post/embed` | POST | 无 | — | 公开 | — |
| `/api/post/embed/batch` | POST | 无 | — | 公开 | — |
| `/api/post/embed/queue` | GET | 无 | — | 公开 | — |
| `/api/post/[id]/versions` | GET | 无 | — | 公开 | — |
| `/api/post/[id]/versions/[version]` | GET | 无 | — | 公开 | — |
| `/api/post/[id]/versions/diff` | GET | 无 | — | 公开 | — |
| `/api/post/[id]/versions/[version]/rollback` | POST | 无 | — | `post:edit` | `self/all` |

> ① GET `[id]`: 已删除文章仅 admin 可看；隐藏文章仅 admin 或作者可看
>
> ② GET `list`: `is_delete=1` 需 admin；`hide=all` 需 admin；`hide=1` 非 admin 只能看自己的

### 用户模块 (User)

| 路由 | 方法 | 当前权限检查 | 数据权限 | 迁移权限码 | data_scope |
|------|------|-------------|----------|-----------|------------|
| `/api/user/login` | POST | 无（登录入口） | — | 公开 | — |
| `/api/user/register` | POST | 无（注册入口） | — | 公开 | — |
| `/api/user/logout` | POST | 无 | — | 公开 | — |
| `/api/user/info` | GET | 仅登录验证 | — | `user:view` | `self` |
| `/api/user/info` | PUT | 仅登录验证 | — | `user:manage` | `self` |
| `/api/user/list` | GET | `isAdmin()` | — | `user:view` | `all` |
| `/api/user/create` | POST | `isAdmin()` | — | `user:manage` | `all` |
| `/api/user/[id]` | GET | `isAdmin()` | — | `user:view` | `all` |
| `/api/user/[id]` | PUT | `isAdmin()` | — | `user:manage` | `all` |
| `/api/user/[id]` | DELETE | `isAdmin()` | — | `user:manage` | `all` |
| `/api/user/token/long-term` | POST/GET/DELETE | 仅登录验证 | — | 公开 | — |
| `/api/user/token/oauth` | GET/DELETE | 仅登录验证 | — | 公开 | — |

### 配置模块 (Config)

| 路由 | 方法 | 当前权限检查 | 数据权限 | 迁移权限码 | data_scope |
|------|------|-------------|----------|-----------|------------|
| `/api/config` | POST | `isAdmin()` | — | `config:edit` | `all` |
| `/api/config/list` | GET | `isAdmin()` | — | `config:view` | `all` |
| `/api/config/[id]` | GET | `isAdmin()` | — | `config:view` | `all` |
| `/api/config/[id]` | PUT | `isAdmin()` | — | `config:edit` | `all` |
| `/api/config/[id]` | DELETE | `isAdmin()` | — | `config:edit` | `all` |
| `/api/config/key/[key]` | GET | 无 | — | 公开 | — |

### 评论模块 (Comment)

| 路由 | 方法 | 当前权限检查 | 数据权限 | 迁移权限码 | data_scope |
|------|------|-------------|----------|-----------|------------|
| `/api/comment/create` | POST | 仅登录验证 | — | `comment:create` | — |
| `/api/comment/list` | GET | 前台无/后台 `isAdmin()` | — | `comment:view` / `comment:manage` | — |
| `/api/comment/[id]` | DELETE | admin 可删任意/普通用户删自己 | 是 | `comment:manage` | `self/all` |
| `/api/comment/[id]/like` | POST | 仅登录验证 | — | 公开 | — |

### 合集模块 (Collection)

| 路由 | 方法 | 当前权限检查 | 数据权限 | 迁移权限码 | data_scope |
|------|------|-------------|----------|-----------|------------|
| `/api/collection/create` | POST | `canManageCollections()` | — | `collection:create` | `all` |
| `/api/collection/[id]` | PUT | `canManageCollections()` | — | `collection:edit` | `all` |
| `/api/collection/[id]` | DELETE | `canManageCollections()` | — | `collection:delete` | `all` |
| `/api/collection/[id]/posts` | POST | `canManageCollections()` | — | `collection:edit` | `all` |
| `/api/collection/[id]/posts` | DELETE | `canManageCollections()` | — | `collection:edit` | `all` |
| `/api/collection/[id]/posts/sort` | PUT | `canManageCollections()` | — | `collection:edit` | `all` |
| `/api/collections` | GET | 无 | — | 公开 | — |
| `/api/collections/[identifier]` | GET | 无 | — | 公开 | — |
| `/api/collections/[identifier]/likes` | POST | 仅登录验证 | — | 公开 | — |

### AI / 功能模块

| 路由 | 方法 | 当前权限检查 | 数据权限 | 迁移权限码 | data_scope |
|------|------|-------------|----------|-----------|------------|
| `/api/ai/generate/description` | POST | 无 | — | 公开 | — |
| `/api/ai/process` | POST/GET | 无 | — | 公开 | — |
| `/api/chat` | POST/GET | 无 | — | 公开 | — |
| `/api/image-gen` | POST | `isAdmin()` | — | `ai:image` | `all` |
| `/api/search/vector` | POST | `isAdmin()` | — | `search:vector` | `all` |
| `/api/tts/synthesize` | POST | `isAdmin()` | — | `ai:tts` | `all` |

### 其他模块

| 路由 | 方法 | 当前权限检查 | 数据权限 | 迁移权限码 | data_scope |
|------|------|-------------|----------|-----------|------------|
| `/api/auth/login` | POST/GET | 无（登录入口） | — | 公开 | — |
| `/api/face/login` | POST | 无 | — | 公开 | — |
| `/api/face/register` | POST/DELETE | 无 | — | 公开 | — |
| `/api/face/status` | GET | 无 | — | 公开 | — |
| `/api/fs/proxy-image` | GET | 无 | — | 公开 | — |
| `/api/fs/upload` | POST | 仅登录验证 | — | 公开 | — |
| `/api/github/auth` | GET | 无 | — | 公开 | — |
| `/api/github/callback` | GET | 无 | — | 公开 | — |
| `/api/github/unbind` | POST | 仅登录验证 | — | 公开 | — |
| `/api/health` | GET | 无 | — | 公开 | — |
| `/api/entity-change/[entityType]/[entityId]` | GET | 无 | — | 公开 | — |
| `/api/oauth/authorize` | POST | `authenticateMcpRequest` | — | MCP 专用 | — |
| `/api/wechat/*` | 各种 | 无 | — | 公开 | — |

---

## MCP 接口清单

### MCP 服务器信息

| 属性 | 值 |
|------|-----|
| 文件 | `src/app/api/mcp/route.ts` |
| 名称 | `React Blog MCP` |
| 版本 | `1.0.0` |
| 协议 | MCP `2024-11-05` |
| 传输 | HTTP POST (无状态 JSON-RPC) |
| 认证 | OAuth 2.0 Bearer Token |

### MCP 工具列表 (5 个)

| 工具名 | 标题 | 权限检查 | 输入参数 | 迁移权限码 |
|--------|------|----------|----------|-----------|
| `create_article` | Create article | 仅 `ensureAuth()` | `title`(必填), `content`(必填), `category`, `tags`, `collections`, `description`, `cover`, `hide` | `post:create` |
| `update_article` | Update article | 仅 `ensureAuth()` | `id`(必填), `title`, `content`, `category`, `tags`, `description`, `cover`, `hide`, `add_to_collections`, `remove_from_collections` | `post:edit` |
| `delete_article` | Delete article | 仅 `ensureAuth()` | `id`(必填) | `post:delete` |
| `get_article` | Get article | 仅 `ensureAuth()` | `id`(可选), `title`(可选) | `post:view` |
| `list_articles` | List articles | 仅 `ensureAuth()` | `pageNum`, `pageSize`, `keyword`, `hide` | `post:view` |

### MCP 资源列表

| 资源名 | URI | 描述 | 迁移处理 |
|--------|-----|------|----------|
| `tags` | `blog://tags` | 所有标签及计数 | 保留手动注册 |
| `collections` | `blog://collections` | 所有合集信息 | 保留手动注册 |
| `prompt_skills` | `blog://skills` | 全部 ACTIVE Prompt Skill metadata | 动态注册，复用 AI Lab Skill 服务 |
| `prompt_skill` | `blog://skills/{slug}` | 按 slug 读取当前激活 Skill 正文 | `ResourceTemplate` 动态注册 |
| 动态 ref docs | `blog://ref/<name>` | 参考文档 | 保留手动注册 |

---

## 需注册到 api_registry 的接口

### 第一优先级（需要权限控制的接口）

这些接口需要注册到 `TbApiRegistry`，用于权限检查和 MCP 自动注册。

| code | name | api_path | api_method | permission_code | mcp_enabled | 说明 |
|------|------|----------|------------|-----------------|-------------|------|
| `post_create` | 创建文章 | `/api/post/create` | POST | `post:create` | ✅ | 已有 MCP 工具 |
| `post_update` | 更新文章 | `/api/post/[id]` | PUT | `post:edit` | ✅ | 已有 MCP 工具 |
| `post_delete` | 删除文章 | `/api/post/[id]` | DELETE | `post:delete` | ✅ | 已有 MCP 工具 |
| `post_get` | 获取文章 | `/api/post/[id]` | GET | `post:view` | ✅ | 已有 MCP 工具 |
| `post_list` | 文章列表 | `/api/post/list` | GET | `post:view` | ✅ | 已有 MCP 工具 |
| `post_hide` | 隐藏文章 | `/api/post/[id]` | PATCH | `post:hide` | ❌ | 隐藏/显示切换 |
| `post_restore` | 恢复文章 | `/api/post/[id]` | PATCH | `post:restore` | ❌ | 恢复已删除文章 |
| `collection_create` | 创建合集 | `/api/collection/create` | POST | `collection:create` | ❌ | 仅 admin |
| `collection_update` | 编辑合集 | `/api/collection/[id]` | PUT | `collection:edit` | ❌ | 仅 admin |
| `collection_delete` | 删除合集 | `/api/collection/[id]` | DELETE | `collection:delete` | ❌ | 仅 admin |
| `collection_manage_posts` | 管理合集文章 | `/api/collection/[id]/posts` | POST/DELETE | `collection:edit` | ❌ | 仅 admin |
| `config_create` | 创建配置 | `/api/config` | POST | `config:edit` | ❌ | 仅 admin |
| `config_update` | 修改配置 | `/api/config/[id]` | PUT | `config:edit` | ❌ | 仅 admin |
| `config_delete` | 删除配置 | `/api/config/[id]` | DELETE | `config:edit` | ❌ | 仅 admin |
| `user_list` | 用户列表 | `/api/user/list` | GET | `user:view` | ❌ | 仅 admin |
| `user_create` | 创建用户 | `/api/user/create` | POST | `user:manage` | ❌ | 仅 admin |
| `user_update` | 编辑用户 | `/api/user/[id]` | PUT | `user:manage` | ❌ | 仅 admin |
| `user_delete` | 删除用户 | `/api/user/[id]` | DELETE | `user:manage` | ❌ | 仅 admin |
| `comment_delete` | 删除评论 | `/api/comment/[id]` | DELETE | `comment:manage` | ❌ | admin 或作者 |
| `image_gen` | AI 图片生成 | `/api/image-gen` | POST | `ai:image` | ❌ | 仅 admin |
| `vector_search` | 向量搜索 | `/api/search/vector` | POST | `search:vector` | ❌ | 仅 admin |
| `tts_synthesize` | 语音合成 | `/api/tts/synthesize` | POST | `ai:tts` | ❌ | 仅 admin |

### 第二优先级（公开接口，仅用于文档化）

这些接口不需要权限控制，但可以注册用于 API 文档和 MCP 资源管理。

| code | name | api_path | api_method | permission_code | 说明 |
|------|------|----------|------------|-----------------|------|
| `post_detail` | 文章详情 | `/api/post/detail` | GET | — | 公开 |
| `post_archives` | 文章归档 | `/api/post/archives` | GET | — | 公开 |
| `post_tags` | 标签列表 | `/api/post/tags` | GET | — | 公开 |
| `post_by_path` | 按路径获取 | `/api/post/by-path/[...path]` | GET | — | 公开 |
| `collection_list` | 合集列表 | `/api/collections` | GET | — | 公开 |
| `collection_detail` | 合集详情 | `/api/collections/[identifier]` | GET | — | 公开 |
| `config_get_by_key` | 按 key 获取配置 | `/api/config/key/[key]` | GET | — | 公开 |
| `comment_list` | 评论列表 | `/api/comment/list` | GET | — | 公开 |
| `health` | 健康检查 | `/api/health` | GET | — | 公开 |

---

## 权限检查模式分析

### 当前使用的 4 种模式

#### 模式 1: 直接 `isAdmin()` 检查

```typescript
// 最常见模式
const token = getTokenFromRequest(request.headers);
const user = token ? await validateToken(token) : null;
if (!user || !isAdmin(user.role)) {
  return NextResponse.json(errorResponse('无权限'), { status: 403 });
}
```

**使用场景**: config、user 管理、image-gen、search/vector、tts

#### 模式 2: 语义化权限函数

```typescript
// 使用 permission.ts 中的函数
const { user, error } = await validateUserFromRequest(request.headers);
if (error) return unauthorizedResponse();
if (!canManageCollections(user)) {
  return forbiddenResponse();
}
```

**使用场景**: collection CRUD、post CRUD

#### 模式 3: 仅登录验证

```typescript
// 只检查 token 是否有效
const token = getTokenFromRequest(request.headers);
const user = token ? await validateToken(token) : null;
if (!user) {
  return NextResponse.json(errorResponse('未登录'), { status: 401 });
}
```

**使用场景**: post/create、comment/create、user/info

#### 模式 4: MCP `ensureAuth()`

```typescript
// MCP 专用，仅验证身份不检查角色
const ensureAuth = async () => {
  return await authenticateMcpRequestEnhanced(headers);
};
```

**使用场景**: 所有 MCP 工具和资源

### 迁移后的统一模式

```typescript
// 统一使用 requirePermission
const check = await requirePermission(request, 'post:create');
if ('error' in check) {
  return NextResponse.json(errorResponse(check.error), { status: check.status });
}
const { user } = check;

// 数据权限检查
if (!hasDataPermission(user, 'post:edit', post.created_by)) {
  return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
}
```

---

## 迁移注意事项

### 1. MCP 安全不一致（P0）

**问题**: MCP 的 5 个工具中，`ensureAuth()` 仅验证身份不检查角色。`delete_article` 对所有登录用户开放，而 REST API 中删除文章需要 admin 权限。

**影响**: 普通用户可通过 MCP 删除任意文章。

**解决**: 迁移时必须在 MCP 转发层增加权限检查（已在设计文档中修复）。

### 2. `requireAdmin` / `requirePermission` 中间件未被使用

**问题**: `permission.ts` 中定义了这些中间件函数，但所有 API 路由都是手动获取 token 再检查 `isAdmin()`。

**影响**: 代码重复，维护困难。

**解决**: 迁移时统一使用 `requirePermission` 替代手动检查。

### 3. 部分路由无显式权限检查

以下路由当前无权限检查，迁移时需要决定是否增加：

| 路由 | 建议 |
|------|------|
| `/api/config/key/[key]` | 保持公开（配置项可能被前端读取） |
| `/api/post/detail` | 保持公开 |
| `/api/post/query` | 保持公开 |
| `/api/fs/proxy-image` | 保持公开 |
| `/api/post/[id]/embed` | 保持公开 |
| `/api/post/[id]/versions` | 保持公开 |

### 4. 权限字段到权限码的映射

当前的 6 个布尔权限字段需要映射到新的权限码体系：

| 旧字段 | 新权限码 | 说明 |
|--------|---------|------|
| `canAccessConfig` | `config:view` + `config:edit` | 拆分为查看和编辑 |
| `canAccessUserManagement` | `user:view` + `user:manage` | 拆分为查看和管理 |
| `canCreatePost` | `post:create` | 一对一映射 |
| `canEditPost` | `post:edit` | 一对一映射 |
| `canDeletePost` | `post:delete` | 一对一映射 |
| `canManageComments` | `comment:manage` | 一对一映射 |

### 5. 数据权限的当前实现

以下接口已有数据权限检查（`self` vs `all`），迁移时需要保留：

| 接口 | 当前实现 | data_scope |
|------|---------|------------|
| 文章编辑 | `canAccessPost(user, post, 'edit')` | `self` (普通用户) / `all` (admin) |
| 文章删除 | `canAccessPost(user, post, 'delete')` | `all` (仅 admin) |
| 评论删除 | admin 可删任意/普通用户删自己 | `self` / `all` |
| 用户信息 | `canAccessUser(user, targetId, 'edit')` | `self` (普通用户) / `all` (admin) |

### 6. Token 类型兼容

迁移后需要支持三种 Token 格式：

| Token 类型 | 前缀 | 存储 | 说明 |
|-----------|------|------|------|
| 登录 Token | 无 | Redis `user:<token>` | 登录时生成，7 天有效期 |
| 长期 Token | `LTK_` | 数据库 `tb_long_term_token` | 用户手动生成，可设过期时间 |
| OAuth Token | 无 | Redis `token:<token>` | MCP OAuth 授权生成 |

---

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-05-15 | 1.0.0 | 初始版本，记录现有权限和 MCP 接口完整盘点 |
