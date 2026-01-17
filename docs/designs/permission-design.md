# 权限系统设计规范

本文档定义了项目的权限系统设计原则、实现规范和最佳实践。

## 📋 目录

- [设计原则](#设计原则)
- [权限模型](#权限模型)
- [权限检查层级](#权限检查层级)
- [API 权限实现规范](#api-权限实现规范)
- [通用权限工具](#通用权限工具)
- [最佳实践](#最佳实践)

---

## 设计原则

### 1. **多层防护原则**
权限检查必须在多个层面实现，确保没有任何单点故障：
- ✅ **前端 UI 控制**：隐藏用户无权访问的功能
- ✅ **路由守卫**：在页面级别拦截未授权访问
- ✅ **API 权限验证**：在 API 入口处验证权限（核心）
- ⚠️ **服务层过滤**：在数据查询时过滤无权访问的数据

**关键原则**：前端控制只负责用户体验，真正的权限验证必须在 API 层完成。

### 2. **最小权限原则**
- 用户只能访问其职责范围内的最小权限集合
- 默认拒绝：除非明确授权，否则拒绝访问
- 权限继承：管理员拥有所有权限，普通用户只能操作自己的资源

### 3. **资源所有权原则**
- **普通用户**：只能查看和编辑自己创建的资源（文章、配置等）
- **管理员**：可以查看和操作所有资源
- **例外**：某些敏感操作（如删除、管理用户）仅管理员可执行

### 4. **防御性编程原则**
- 永远不信任客户端请求
- 所有 API 必须验证用户身份和权限
- 即使前端已隐藏功能，API 仍需权限检查

---

## 权限模型

### 角色定义

项目使用 RBAC（基于角色的访问控制）模型，定义了三种角色：

| 角色 | 代码值 | 说明 |
|------|--------|------|
| **管理员** | `admin` | 拥有所有权限，可以管理系统配置、用户、合集等 |
| **普通用户** | `user` | 只能管理自己创建的内容（文章、个人信息） |
| **访客** | `guest` | 未登录用户，只能查看公开内容 |

### 权限矩阵

| 资源/操作 | 访客 | 普通用户 | 管理员 |
|----------|------|----------|--------|
| **文章管理** |
| 查看显示的文章 | ✅ | ✅ | ✅ |
| 查看隐藏的文章 | ❌ | ✅（自己的） | ✅（所有） |
| 创建文章 | ❌ | ✅ | ✅ |
| 编辑文章 | ❌ | ✅（自己的） | ✅（所有） |
| 删除文章 | ❌ | ❌ | ✅ |
| 查看已删除文章 | ❌ | ❌ | ✅ |
| **合集管理** |
| 查看合集 | ✅ | ✅ | ✅ |
| 创建/编辑/删除合集 | ❌ | ❌ | ✅ |
| 管理合集文章 | ❌ | ❌ | ✅ |
| **配置管理** |
| 查看系统配置 | ❌ | ❌ | ✅ |
| 修改系统配置 | ❌ | ❌ | ✅ |
| **用户管理** |
| 查看个人信息 | ❌ | ✅（自己的） | ✅（所有） |
| 编辑个人信息 | ❌ | ✅（自己的） | ✅（所有） |
| 管理用户 | ❌ | ❌ | ✅ |

---

## 权限检查层级

### 1. 前端 UI 控制
**位置**：`src/app/c/layout.tsx`, 各页面组件

**目的**：提升用户体验，隐藏无权访问的功能

**示例**：
```typescript
// 仅管理员显示的菜单
{isAdmin(user?.role) && (
  <Menu.Item key="/c/config">配置管理</Menu.Item>
)}

// 仅管理员显示的筛选器
{isAdmin(user?.role) && (
  <Select>是否包含已删除</Select>
)}
```

**⚠️ 重要**：前端控制不等于权限验证，仅用于优化用户体验。

### 2. 路由守卫
**位置**：`src/app/c/layout.tsx`

**目的**：防止用户直接访问无权限的 URL

**示例**：
```typescript
useEffect(() => {
  if (!loading && user) {
    const adminOnlyPaths = ['/c/collections', '/c/config', '/c/user'];
    const isAdminPath = adminOnlyPaths.some(path => pathname.startsWith(path));

    if (isAdminPath && !isAdmin(user.role)) {
      message.warning('您没有权限访问此页面');
      router.push('/c/post');
    }
  }
}, [user, loading, pathname, router]);
```

### 3. API 权限验证（核心）
**位置**：所有 API 路由文件

**目的**：真正的权限验证，防止绕过前端的恶意请求

**标准流程**：
```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    // 2. 验证用户权限
    if (!canManageCollections(user)) {
      return NextResponse.json(errorResponse('无权限创建合集'), { status: 403 });
    }

    // 3. 执行业务逻辑
    const result = await createCollection(data);

    return NextResponse.json(successResponse(result));
  } catch (error) {
    // 错误处理
  }
}
```

### 4. 服务层数据过滤
**位置**：`src/services/`, 数据库查询

**目的**：确保即使权限检查失败，用户也无法获取无权访问的数据

**示例**：
```typescript
// 普通用户查询文章时，强制过滤只返回自己的文章
if (!isAdmin(user?.role)) {
  whereConditions.created_by = user.id;
}
```

---

## API 权限实现规范

### 标准权限检查模式

#### 1. 管理员专属 API
**适用场景**：系统配置、用户管理、合集管理

```typescript
import { canManageConfig } from '@/lib/permission';

export async function POST(request: NextRequest) {
  // 验证身份
  const { user, error } = await validateUserFromRequest(request.headers);
  if (error) {
    return NextResponse.json(errorResponse(error), { status: 401 });
  }

  // 验证权限
  if (!canManageConfig(user)) {
    return NextResponse.json(errorResponse('无权限访问'), { status: 403 });
  }

  // 业务逻辑
  // ...
}
```

#### 2. 资源所有权 API
**适用场景**：文章管理、用户信息编辑

```typescript
import { canAccessPost } from '@/lib/permission';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 验证身份
  const { user, error } = await validateUserFromRequest(request.headers);
  if (error) {
    return NextResponse.json(errorResponse(error), { status: 401 });
  }

  // 获取资源
  const post = await getPostById(postId);
  if (!post) {
    return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
  }

  // 验证权限（管理员或作者本人）
  if (!canAccessPost(user, post, 'edit')) {
    return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
  }

  // 业务逻辑
  // ...
}
```

#### 3. 用户信息 API
**适用场景**：查看/编辑用户信息

```typescript
import { canAccessUser } from '@/lib/permission';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 验证身份
  const { user, error } = await validateUserFromRequest(request.headers);
  if (error) {
    return NextResponse.json(errorResponse(error), { status: 401 });
  }

  const targetUserId = parseInt(id, 10);

  // 验证权限（管理员或用户本人）
  if (!canAccessUser(user, targetUserId, 'edit')) {
    return NextResponse.json(errorResponse('无权限编辑此用户'), { status: 403 });
  }

  // 业务逻辑
  // ...
}
```

### HTTP 状态码规范

| 状态码 | 场景 | 示例 |
|--------|------|------|
| **200** | 操作成功 | 更新成功、删除成功 |
| **400** | 请求参数错误 | pageSize 超出范围 |
| **401** | 未登录或 Token 无效 | 未授权、登录已过期 |
| **403** | 已登录但权限不足 | 无权限访问、无权限编辑 |
| **404** | 资源不存在 | 文章不存在、用户不存在 |
| **500** | 服务器内部错误 | 数据库连接失败 |

---

## 通用权限工具

### 文件位置
`src/lib/permission.ts`

### 身份验证函数

#### `validateUserFromRequest(headers: Headers)`
从请求中验证用户身份

```typescript
const { user, error } = await validateUserFromRequest(request.headers);
if (error) {
  return NextResponse.json(errorResponse(error), { status: 401 });
}
```

#### `requireAdmin(headers: Headers)`
验证用户是否为管理员

```typescript
const { user, error } = await requireAdmin(request.headers);
if (error) {
  return NextResponse.json(errorResponse(error), { status: error === '未授权' ? 401 : 403 });
}
```

### 资源权限检查函数

#### `canAccessPost(user, post, operation)`
检查是否有权限操作指定文章

```typescript
if (!canAccessPost(user, post, 'edit')) {
  return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
}
```

#### `canAccessUser(currentUser, targetUserId, operation)`
检查是否有权限操作指定用户

```typescript
if (!canAccessUser(currentUser, targetUserId, 'edit')) {
  return NextResponse.json(errorResponse('无权限编辑此用户'), { status: 403 });
}
```

#### `canManageConfig(user)` / `canManageCollections(user)` / `canManageUsers(user)`
检查是否有管理权限

```typescript
if (!canManageConfig(user)) {
  return NextResponse.json(errorResponse('无权限管理配置'), { status: 403 });
}
```

---

## 最佳实践

### ✅ 推荐做法

#### 1. **所有 API 都要验证身份**
```typescript
export async function POST(request: NextRequest) {
  const { user, error } = await validateUserFromRequest(request.headers);
  if (error) {
    return NextResponse.json(errorResponse(error), { status: 401 });
  }
  // 业务逻辑
}
```

#### 2. **使用封装的权限检查函数**
```typescript
// ✅ 推荐
if (!canManageCollections(user)) {
  return NextResponse.json(errorResponse('无权限'), { status: 403 });
}

// ❌ 不推荐（重复实现）
if (!isAdmin(user?.role)) {
  return NextResponse.json(errorResponse('无权限'), { status: 403 });
}
```

#### 3. **先检查权限，再查询数据**
```typescript
// ✅ 推荐（先检查权限）
if (!canManageConfig(user)) {
  return NextResponse.json(errorResponse('无权限'), { status: 403 });
}
const config = await getConfigById(id);

// ❌ 不推荐（先查询数据）
const config = await getConfigById(id);
if (!canManageConfig(user)) {
  return NextResponse.json(errorResponse('无权限'), { status: 403 });
}
```

#### 4. **明确的错误消息**
```typescript
// ✅ 推荐（明确指出权限不足）
return NextResponse.json(errorResponse('无权限创建合集'), { status: 403 });

// ❌ 不推荐（模糊的错误消息）
return NextResponse.json(errorResponse('操作失败'), { status: 403 });
```

### ❌ 避免的做法

#### 1. **只依赖前端权限控制**
```typescript
// ❌ 错误：前端隐藏了，但 API 没有验证
export async function DELETE(request: NextRequest) {
  // 没有权限检查！
  await deleteCollection(id);
  return NextResponse.json(successResponse(null, '删除成功'));
}
```

#### 2. **在 API 中信任用户角色**
```typescript
// ❌ 错误：从请求体中读取角色
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.role !== 'admin') {  // 用户可以伪造角色！
    return NextResponse.json(errorResponse('无权限'), { status: 403 });
  }
}

// ✅ 正确：从 Token 中验证角色
export async function POST(request: NextRequest) {
  const user = await validateUser(token);  // 从服务器端验证
  if (!canManageCollections(user)) {
    return NextResponse.json(errorResponse('无权限'), { status: 403 });
  }
}
```

#### 3. **忽略资源所有权检查**
```typescript
// ❌ 错误：只检查登录状态，不检查资源所有权
export async function PUT(request: NextRequest, context) {
  const user = await validateUser(token);
  const post = await getPostById(id);
  await updatePost(id, data);  // 用户可以修改别人的文章！
}

// ✅ 正确：检查资源所有权
export async function PUT(request: NextRequest, context) {
  const user = await validateUser(token);
  const post = await getPostById(id);

  if (!canAccessPost(user, post, 'edit')) {
    return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
  }

  await updatePost(id, data);
}
```

---

## 特殊场景处理

### 1. 隐藏文章的权限
- **管理员**：可以查看所有人的隐藏文章
- **普通用户**：可以查看自己的隐藏文章（用于恢复）
- **访客**：无法查看隐藏文章

实现：
```typescript
if (post.hide === '1') {
  const token = getTokenFromRequest(request.headers);
  const user = token ? await validateToken(token) : null;

  // 不是管理员且不是作者本人
  if (!isAdmin(user?.role) && user?.id !== post.created_by) {
    return NextResponse.json(errorResponse('无权限查看此隐藏文章'), { status: 403 });
  }
}
```

### 2. 已删除文章的权限
- **管理员**：可以选择查看已删除文章（通过 `is_delete=1` 参数）
- **普通用户**：绝对不能查看任何已删除文章（包括自己的）

实现：
```typescript
// 列表 API
if (isDelete === '1' && !isAdmin(user?.role)) {
  return NextResponse.json(errorResponse('无权限查看已删除文章'), { status: 403 });
}

// 详情 API
if (post.is_delete === 1 && !isAdmin(user?.role)) {
  return NextResponse.json(errorResponse('无权限查看已删除文章'), { status: 403 });
}
```

### 3. 软删除与硬删除
- **软删除**（推荐）：设置 `is_delete=1`，数据保留在数据库中
- **硬删除**：物理删除数据，需要管理员权限

---

## 权限检查清单

在开发新的 API 时，请按照以下清单检查：

- [ ] 是否验证了用户身份（Token 验证）？
- [ ] 是否检查了用户权限（角色/资源所有权）？
- [ ] 是否使用了封装的权限检查函数？
- [ ] 是否返回了正确的 HTTP 状态码？
- [ ] 错误消息是否明确指出权限不足？
- [ ] 是否考虑了绕过前端直接调用 API 的情况？
- [ ] 是否在服务层也做了数据过滤？

---

## 测试建议

### 单元测试
为权限检查函数编写单元测试：
```typescript
describe('canAccessPost', () => {
  it('应该允许管理员编辑所有文章', () => {
    expect(canAccessPost(adminUser, post, 'edit')).toBe(true);
  });

  it('应该允许普通用户编辑自己的文章', () => {
    expect(canAccessPost(normalUser, ownPost, 'edit')).toBe(true);
  });

  it('应该拒绝普通用户编辑他人的文章', () => {
    expect(canAccessPost(normalUser, othersPost, 'edit')).toBe(false);
  });
});
```

### 集成测试
测试 API 端点的权限控制：
```typescript
describe('POST /api/collection/create', () => {
  it('应该允许管理员创建合集', async () => {
    const response = await request(app)
      .post('/api/collection/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test' });

    expect(response.status).toBe(200);
  });

  it('应该拒绝普通用户创建合集', async () => {
    const response = await request(app)
      .post('/api/collection/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Test' });

    expect(response.status).toBe(403);
  });
});
```

---

## 常见问题

### Q1: 为什么需要多层权限检查？
**A**: 前端控制只负责用户体验，真正的安全防护必须在 API 层。多层防护确保即使某一层被绕过，其他层仍能保护系统安全。

### Q2: 可以只在前端做权限控制吗？
**A**: 绝对不可以。前端代码可以被用户篡改，API 请求可以用任何工具（Postman、curl 等）直接发送。真正的权限验证必须在服务端完成。

### Q3: 为什么不直接在数据库层做权限过滤？
**A**: 数据库层应该做最后一道防线，但仅依赖数据库层会导致：
- 无法提供友好的错误消息
- 难以实现复杂的业务逻辑
- 性能问题（所有数据都查出来再过滤）

### Q4: 如何处理权限升级？
**A**:
1. 在 API 中检查当前用户是否有权限授予他人更高权限
2. 只有管理员可以提升他人为管理员
3. 普通用户不能提升自己的权限

---

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2025-01-16 | 1.0.0 | 初始版本，定义权限系统设计规范 |
