# 后端开发规范

## API 路由规范

### 路由约定
- **位置**: `src/app/api/` 目录
- **文件名**: `route.ts`
- **HTTP 方法**: GET, POST, PUT, DELETE, PATCH

### 路由结构示例
```
src/app/api/
├── user/
│   ├── login/route.ts          # POST /api/user/login
│   ├── logout/route.ts         # POST /api/user/logout
│   ├── info/route.ts           # GET /api/user/info
│   ├── [id]/route.ts           # GET/PUT/DELETE /api/user/:id
│   └── list/route.ts           # GET /api/user/list
├── post/
│   ├── list/route.ts           # GET /api/post/list
│   ├── create/route.ts         # POST /api/post/create
│   ├── detail/route.ts         # GET /api/post/detail
│   └── [id]/route.ts           # GET/PUT/DELETE /api/post/:id
└── upload/route.ts             # POST /api/upload
```

### 路由文件模板

#### 基础路由
```typescript
/**
 * 用户信息API
 * GET /api/user/info
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserInfo } from '@/services/user'
import { getUserFromToken } from '@/lib/auth'
import { successResponse, errorResponse } from '@/dto/response.dto'

export async function GET(request: NextRequest) {
  try {
    // 1. 获取用户信息
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json(
        errorResponse('未登录'),
        { status: 401 }
      )
    }

    // 2. 获取完整用户信息
    const userInfo = await getUserInfo(user.id)
    if (!userInfo) {
      return NextResponse.json(
        errorResponse('用户不存在'),
        { status: 404 }
      )
    }

    // 3. 返回成功响应
    return NextResponse.json(successResponse(userInfo, '获取成功'))
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return NextResponse.json(
      errorResponse('获取用户信息失败'),
      { status: 500 }
    )
  }
}
```

#### 动态路由
```typescript
/**
 * 文章详情API
 * GET /api/post/[id]
 * PUT /api/post/[id]
 * DELETE /api/post/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPostById, updatePost, deletePost } from '@/services/post'
import { successResponse, errorResponse } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const post = await getPostById(Number(id))

    if (!post) {
      return NextResponse.json(
        errorResponse('文章不存在'),
        { status: 404 }
      )
    }

    return NextResponse.json(successResponse(post))
  } catch (error) {
    console.error('获取文章失败:', error)
    return NextResponse.json(
      errorResponse('获取文章失败'),
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json()

    const post = await updatePost(Number(id), body)
    if (!post) {
      return NextResponse.json(
        errorResponse('文章不存在'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      successResponse(post, '更新成功')
    )
  } catch (error) {
    console.error('更新文章失败:', error)
    return NextResponse.json(
      errorResponse('更新文章失败'),
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const success = await deletePost(Number(id))

    if (!success) {
      return NextResponse.json(
        errorResponse('删除失败'),
        { status: 500 }
      )
    }

    return NextResponse.json(successResponse(null, '删除成功'))
  } catch (error) {
    console.error('删除文章失败:', error)
    return NextResponse.json(
      errorResponse('删除失败'),
      { status: 500 }
    )
  }
}
```

## 响应格式规范

### 统一响应格式
```typescript
// src/dto/response.dto.ts
export interface ApiResponse<T = unknown> {
  status: boolean      // true: 成功, false: 失败
  message: string      // 提示信息
  data: T | null      // 响应数据
}

// 成功响应
export function successResponse<T>(
  data: T,
  message = '操作成功'
): ApiResponse<T> {
  return {
    status: true,
    message,
    data,
  }
}

// 错误响应
export function errorResponse(
  message = '操作失败',
  data: unknown = null
): ApiResponse {
  return {
    status: false,
    message,
    data,
  }
}
```

### HTTP 状态码规范
- **200**: 成功
- **201**: 创建成功
- **400**: 请求参数错误
- **401**: 未授权/未登录
- **403**: 无权限
- **404**: 资源不存在
- **500**: 服务器错误

```typescript
// 示例
// 400 - 参数错误
return NextResponse.json(
  errorResponse('账号和密码不能为空'),
  { status: 400 }
)

// 401 - 未登录
return NextResponse.json(
  errorResponse('未登录'),
  { status: 401 }
)

// 403 - 无权限
return NextResponse.json(
  errorResponse('无权限访问'),
  { status: 403 }
)

// 404 - 资源不存在
return NextResponse.json(
  errorResponse('用户不存在'),
  { status: 404 }
)

// 500 - 服务器错误
return NextResponse.json(
  errorResponse('服务器错误'),
  { status: 500 }
)
```

## 服务层规范

### 服务层组织
- **位置**: `src/services/` 目录
- **命名**: 按业务模块命名（如 `post.ts`, `user.ts`, `auth.ts`）
- **职责**: 封装业务逻辑和数据库操作

### 服务层示例
```typescript
// src/services/post.ts
import { getPrisma } from '@/lib/prisma'
import type { SerializedPost } from '@/dto/post.dto'
import { TbPost } from '@/generated/prisma-client'

/**
 * 序列化文章数据
 * - 将数据库字符串字段转换为数组
 * - 将日期对象转换为 ISO 字符串
 */
function serializePost(post: TbPost): SerializedPost {
  return {
    ...post,
    tags: post.tags ? post.tags.split(',').map(tag => tag.trim()) : [],
    date: post.date ? new Date(post.date).toISOString() : null,
    updated: post.updated ? new Date(post.updated).toISOString() : null,
  }
}

/**
 * 获取文章列表
 */
export async function getPostList(params: QueryCondition) {
  const { pageNum = 1, pageSize = 10, hide = '0' } = params

  const prisma = await getPrisma()

  const whereConditions = {
    is_delete: 0,
    ...(hide !== 'all' && { hide }),
  }

  const [data, count] = await Promise.all([
    prisma.tbPost.findMany({
      where: whereConditions,
      orderBy: { date: 'desc' },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
    }),
    prisma.tbPost.count({ where: whereConditions }),
  ])

  return {
    record: data.map(serializePost),
    total: count,
    pageNum,
    pageSize,
  }
}

/**
 * 根据ID获取文章
 */
export async function getPostById(id: number): Promise<SerializedPost | null> {
  const prisma = await getPrisma()
  const post = await prisma.tbPost.findUnique({
    where: { id },
  })

  if (!post || post.is_delete !== 0) {
    return null
  }

  return serializePost(post)
}

/**
 * 创建文章
 */
export async function createPost(data: Partial<TbPost>): Promise<SerializedPost> {
  const now = new Date()
  const prisma = await getPrisma()

  // 处理 tags 数组转字符串
  const tagsString = Array.isArray(data.tags)
    ? data.tags.join(',')
    : data.tags

  const result = await prisma.tbPost.create({
    data: {
      title: data.title || null,
      category: data.category || null,
      tags: tagsString || null,
      content: data.content || null,
      date: data.date || now,
      updated: now,
      hide: data.hide || '0',
      is_delete: 0,
      visitors: 0,
      likes: 0,
    },
  })

  return serializePost(result)
}

/**
 * 更新文章
 */
export async function updatePost(
  id: number,
  data: Partial<TbPost>
): Promise<SerializedPost | null> {
  const prisma = await getPrisma()
  const now = new Date()

  const updateData: Record<string, unknown> = {
    updated: now,
    ...data,
  }

  // 处理 tags
  if (Array.isArray(data.tags)) {
    updateData.tags = data.tags.join(',')
  }

  const updatedPost = await prisma.tbPost.update({
    where: { id },
    data: updateData,
  })

  return serializePost(updatedPost)
}

/**
 * 删除文章（软删除）
 */
export async function deletePost(id: number): Promise<boolean> {
  const prisma = await getPrisma()
  const result = await prisma.tbPost.update({
    where: { id },
    data: { is_delete: 1 },
  })
  return !!result
}
```

## 认证和授权

### Token 认证
```typescript
// src/lib/auth.ts
import { NextRequest } from 'next/server'
import { getRedis } from '@/lib/redis'
import type { User } from '@/types'

export const TOKEN_KEY = 'auth_token'

/**
 * 从请求中获取用户信息
 */
export async function getUserFromToken(
  request: NextRequest
): Promise<User | null> {
  // 1. 从 Cookie 获取 token
  const token = request.cookies.get(TOKEN_KEY)?.value

  if (!token) {
    return null
  }

  // 2. 从 Redis 获取用户信息
  const redis = await getRedis()
  const userStr = await redis.get(`token:${token}`)

  if (!userStr) {
    return null
  }

  return JSON.parse(userStr)
}

/**
 * 验证用户权限
 */
export async function checkPermission(
  request: NextRequest,
  requiredRole: string
): Promise<boolean> {
  const user = await getUserFromToken(request)

  if (!user) {
    return false
  }

  // 检查角色权限
  return user.role === requiredRole || user.role === 'admin'
}
```

### 权限中间件
```typescript
// 在 API 路由中使用
export async function POST(request: NextRequest) {
  // 验证登录
  const user = await getUserFromToken(request)
  if (!user) {
    return NextResponse.json(
      errorResponse('未登录'),
      { status: 401 }
    )
  }

  // 验证权限
  const hasPermission = await checkPermission(request, 'admin')
  if (!hasPermission) {
    return NextResponse.json(
      errorResponse('无权限'),
      { status: 403 }
    )
  }

  // 继续处理业务逻辑
  // ...
}
```

## 数据验证

### 使用 Zod 验证
```typescript
import { z } from 'zod'

// 定义验证模式
const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100, '标题不能超过100个字符'),
  content: z.string().min(1, '内容不能为空'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  hide: z.enum(['0', '1']).default('0'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证请求体
    const validatedData = createPostSchema.parse(body)

    // 使用验证后的数据
    const post = await createPost(validatedData)

    return NextResponse.json(successResponse(post, '创建成功'))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(error.errors[0].message),
        { status: 400 }
      )
    }

    console.error('创建文章失败:', error)
    return NextResponse.json(
      errorResponse('创建文章失败'),
      { status: 500 }
    )
  }
}
```

## 文件上传

### 上传处理
```typescript
/**
 * 文件上传API
 * POST /api/upload
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        errorResponse('请选择文件'),
        { status: 400 }
      )
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        errorResponse('不支持的文件类型'),
        { status: 400 }
      )
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        errorResponse('文件大小不能超过5MB'),
        { status: 400 }
      )
    }

    // 生成文件名
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name}`
    const filepath = path.join(process.cwd(), 'public/uploads', filename)

    // 保存文件
    await writeFile(filepath, buffer)

    // 返回文件URL
    const url = `/uploads/${filename}`
    return NextResponse.json(successResponse({ url }, '上传成功'))
  } catch (error) {
    console.error('上传失败:', error)
    return NextResponse.json(
      errorResponse('上传失败'),
      { status: 500 }
    )
  }
}
```

## 缓存策略

### Redis 缓存
```typescript
import { getRedis } from '@/lib/redis'

/**
 * 获取用户信息（带缓存）
 */
export async function getUserInfo(userId: string) {
  const redis = await getRedis()
  const cacheKey = `user:${userId}`

  // 1. 尝试从缓存获取
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // 2. 从数据库查询
  const prisma = await getPrisma()
  const user = await prisma.tbUser.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return null
  }

  // 3. 写入缓存（24小时过期）
  await redis.setex(cacheKey, 86400, JSON.stringify(user))

  return user
}

/**
 * 更新用户信息（删除缓存）
 */
export async function updateUserInfo(userId: string, data: Partial<User>) {
  const prisma = await getPrisma()
  const redis = await getRedis()

  // 1. 更新数据库
  const user = await prisma.tbUser.update({
    where: { id: userId },
    data,
  })

  // 2. 删除缓存
  await redis.del(`user:${userId}`)

  return user
}
```

## 错误处理最佳实践

### 分层错误处理
```typescript
// 1. 服务层抛出业务错误
export class BusinessError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'BusinessError'
  }
}

// 服务层
export async function createPost(data: PostData) {
  if (!data.title) {
    throw new BusinessError('标题不能为空', 400)
  }

  const existing = await getPostByTitle(data.title)
  if (existing) {
    throw new BusinessError('标题已存在', 409)
  }

  // 创建文章
  return await prisma.tbPost.create({ data })
}

// 2. API 路由捕获错误
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const post = await createPost(body)
    return NextResponse.json(successResponse(post, '创建成功'))
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: error.statusCode }
      )
    }

    console.error('创建文章失败:', error)
    return NextResponse.json(
      errorResponse('创建文章失败'),
      { status: 500 }
    )
  }
}
```

## API 文档规范

### JSDoc 注释
```typescript
/**
 * 获取文章列表API
 *
 * @route GET /api/post/list
 * @query pageNum - 页码（默认: 1）
 * @query pageSize - 每页数量（默认: 10）
 * @query hide - 是否隐藏（'0', '1', 'all'）
 * @query query - 搜索关键词
 *
 * @returns {ApiResponse<PageQueryRes<Post>>}
 *
 * @example
 * GET /api/post/list?pageNum=1&pageSize=10&hide=0
 *
 * Response:
 * {
 *   "status": true,
 *   "message": "获取成功",
 *   "data": {
 *     "record": [...],
 *     "total": 100,
 *     "pageNum": 1,
 *     "pageSize": 10
 *   }
 * }
 */
```

## 性能优化

### 数据库查询优化
```typescript
// ✅ 并行查询
const [posts, count] = await Promise.all([
  prisma.tbPost.findMany({ where }),
  prisma.tbPost.count({ where }),
])

// ✅ 只查询需要的字段
const posts = await prisma.tbPost.findMany({
  select: {
    id: true,
    title: true,
    date: true,
    // 不查询 content 字段
  },
})

// ❌ 避免 N+1 查询
// 不好的做法
for (const post of posts) {
  const user = await prisma.tbUser.findUnique({
    where: { id: post.userId },
  })
}

// ✅ 使用 include 或 select
const posts = await prisma.tbPost.findMany({
  include: {
    user: true,
  },
})
```

## 安全最佳实践

### 防止 SQL 注入
- ✅ 使用 Prisma（自动防护）
- ❌ 不要拼接 SQL 字符串

### 防止 XSS
- 前端使用 React（自动转义）
- 返回数据时不要包含 HTML 标签

### 密码安全
```typescript
import bcrypt from 'bcryptjs'

// 密码加密
const hashedPassword = await bcrypt.hash(password, 10)

// 密码验证
const isValid = await bcrypt.compare(password, hashedPassword)
```

### 敏感信息保护
```typescript
// ✅ 不返回敏感字段
const user = await prisma.tbUser.findUnique({
  where: { id },
  select: {
    id: true,
    nickname: true,
    avatar: true,
    // 不返回 password 字段
  },
})

// ✅ 使用环境变量
const secret = process.env.JWT_SECRET
```

## 日志规范

### 日志级别
```typescript
// 开发环境：详细日志
console.log('调试信息:', data)
console.error('错误信息:', error)

// 生产环境：只记录错误
if (process.env.NODE_ENV === 'production') {
  console.error('生产环境错误:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  })
}
```

## 测试建议

### API 测试
- 测试正常流程
- 测试边界条件
- 测试错误处理
- 测试权限验证
