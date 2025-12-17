# 通用开发规范

## 项目概述

这是一个基于 Next.js 16 的全栈博客项目，使用 TypeScript、Prisma、Ant Design 和 Tailwind CSS 构建。

## 技术栈

### 核心框架
- **Next.js**: 16.0.8 (App Router)
- **React**: 19.2.1
- **TypeScript**: 5.9.3 (严格模式)
- **Node.js**: >= 18.x
- **包管理器**: pnpm

### UI 和样式
- **Ant Design**: 6.1.1 (企业级UI组件库)
- **Tailwind CSS**: 4.1.17 (原子化CSS框架)
- **CSS Modules**: 支持

### 数据层
- **数据库**: MySQL 5.7+
- **ORM**: Prisma 6.2.1
- **缓存**: Redis (ioredis)

### 认证和授权
- **微信登录**: 企业微信SDK集成
- **GitHub OAuth**: GitHub账号绑定
- **Token机制**: UUID + Redis存储

### 其他工具库
- **Axios**: HTTP客户端
- **dayjs**: 日期处理
- **lodash-es**: 工具函数库
- **bcrypt**: 密码加密
- **zod**: 运行时类型验证

## TypeScript 规范

### 严格模式
- 所有代码必须启用 TypeScript 严格模式
- 禁止使用 `any`，必须明确类型定义
- 使用 `unknown` 代替 `any` 处理未知类型

### 类型定义位置
- 全局类型: `/src/types/`
- DTO类型: `/src/dto/`
- 组件Props类型: 与组件同文件定义

### 路径别名
- 使用 `@/*` 指向 `./src/*`
- 禁止使用相对路径引用跨目录模块

示例:
```typescript
// ✅ 正确
import { User } from '@/types'
import { getUserById } from '@/services/user'

// ❌ 错误
import { User } from '../../types'
import { getUserById } from '../services/user'
```

## 命名规范

### 文件命名
- **组件**: PascalCase (如 `Header.tsx`, `PostCard.tsx`)
- **工具函数**: kebab-case (如 `auth.ts`, `redis.ts`)
- **路由文件**: Next.js 约定 (`page.tsx`, `layout.tsx`, `route.ts`)

### 变量和函数命名
- **变量**: camelCase (如 `userName`, `postList`)
- **常量**: UPPER_SNAKE_CASE (如 `API_BASE_URL`, `MAX_RETRIES`)
- **函数**: camelCase (如 `getUserInfo`, `createPost`)
- **类**: PascalCase (如 `RedisService`, `AuthManager`)
- **接口/类型**: PascalCase (如 `User`, `ApiResponse`)

### 布尔值命名
使用清晰的前缀:
```typescript
// ✅ 正确
const isLoading = true
const hasPermission = false
const canEdit = true
const shouldRender = false

// ❌ 错误
const loading = true
const permission = false
```

## 代码风格

### 导入顺序
按以下顺序组织导入:
1. React 和 Next.js 核心
2. 第三方库
3. UI组件库 (Ant Design)
4. 项目内部模块 (`@/...`)
5. 类型定义
6. 样式文件

示例:
```typescript
// 1. React 和 Next.js
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 2. 第三方库
import axios from 'axios'
import dayjs from 'dayjs'

// 3. UI组件库
import { Button, Form, Input } from 'antd'

// 4. 项目内部模块
import { getUserInfo } from '@/services/user'
import { AuthContext } from '@/contexts/AuthContext'

// 5. 类型定义
import type { User } from '@/types'
import type { ApiResponse } from '@/dto/response.dto'

// 6. 样式
import styles from './styles.module.css'
```

### 注释规范
- **语言**: 所有注释和文档使用中文
- **JSDoc**: 所有函数、类、组件必须包含 JSDoc 注释
- **行内注释**: 复杂逻辑必须添加说明

示例:
```typescript
/**
 * 获取用户信息
 * @param userId 用户ID
 * @returns 用户信息对象
 */
async function getUserInfo(userId: string): Promise<User> {
  // 从缓存中获取用户信息
  const cachedUser = await redis.get(`user:${userId}`)
  if (cachedUser) {
    return JSON.parse(cachedUser)
  }

  // 缓存不存在，从数据库查询
  const user = await prisma.tbUser.findUnique({
    where: { id: userId }
  })

  // 写入缓存，过期时间24小时
  await redis.setex(`user:${userId}`, 86400, JSON.stringify(user))

  return user
}
```

## 错误处理

### API 错误处理
- 所有 API 路由必须使用 try-catch 包裹异步操作
- 错误信息使用中文
- 使用统一的错误响应格式

```typescript
try {
  const result = await someAsyncOperation()
  return NextResponse.json({
    status: true,
    message: '操作成功',
    data: result
  })
} catch (error) {
  console.error('操作失败:', error)
  return NextResponse.json({
    status: false,
    message: error instanceof Error ? error.message : '操作失败',
    data: null
  }, { status: 500 })
}
```

### 客户端错误处理
```typescript
try {
  const response = await axios.get('/api/user/info')
  if (response.data.status) {
    // 处理成功逻辑
  }
} catch (error) {
  if (axios.isAxiosError(error)) {
    message.error(error.response?.data?.message || '请求失败')
  } else {
    message.error('发生未知错误')
  }
}
```

## 环境变量

### 命名规范
- 服务端环境变量: `VARIABLE_NAME`
- 客户端环境变量: `NEXT_PUBLIC_VARIABLE_NAME`

### 关键环境变量
```bash
# 数据库
DATABASE_URL=mysql://user:password@host:port/database

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=
GITHUB_TOKEN=
GITHUB_REPO=

# 微信登录
WECHAT_CORP_ID=
WECHAT_AGENT_ID=
WECHAT_SECRET=

# 公共配置
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_GITHUB_REPO_URL=
```

## Git 规范

### Commit Message
使用语义化提交信息:
- `feat`: 新功能
- `fix`: 修复Bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链更新

示例:
```bash
feat: 添加文章评论功能
fix: 修复用户登录状态丢失问题
docs: 更新API文档
refactor: 重构文章服务层代码
```

### 分支管理
- `main`: 生产环境分支
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复分支

## 性能优化

### 图片优化
- 使用 Next.js `Image` 组件
- 配置合适的图片尺寸和质量

### 代码分割
- 使用 `dynamic` 进行组件懒加载
- 避免在客户端组件中导入大型库

### React 优化
- 合理使用 `React.memo`
- 使用 `useMemo` 缓存计算结果
- 使用 `useCallback` 缓存回调函数
- 已启用 React Compiler，减少手动优化

### 缓存策略
- Redis 缓存热点数据
- 合理设置缓存过期时间
- 使用 Next.js ISR 缓存页面

## 安全规范

### 密码安全
- 使用 bcrypt 加密存储密码
- Salt rounds >= 10

### Token 安全
- Token 存储在 Redis，设置合理过期时间
- Token 传输使用 HTTP-only Cookie

### 输入验证
- 所有用户输入必须验证
- 使用 zod 进行运行时类型检查
- 防止 SQL 注入 (Prisma 自动防护)
- 防止 XSS 攻击

### API 安全
- 敏感操作需要权限验证
- 使用 CORS 限制跨域访问
- 避免暴露敏感信息到前端

## 测试规范

### 单元测试
- 工具函数必须编写测试
- 关键业务逻辑必须覆盖测试

### 测试命名
```typescript
describe('getUserInfo', () => {
  it('应该返回用户信息', async () => {
    // 测试代码
  })

  it('用户不存在时应该抛出错误', async () => {
    // 测试代码
  })
})
```

## 部署规范

### 构建检查
部署前必须检查:
```bash
pnpm run lint      # ESLint 检查
pnpm run typecheck # TypeScript 类型检查
pnpm run build     # 生产构建
```

### Docker 部署
- 使用 `Dockerfile.prod` 构建生产镜像
- 注意 Prisma 的 binaryTargets 配置
- 生产环境使用 `prisma migrate deploy`

### PM2 部署
- 使用 `ecosystem.config.cjs` 配置
- 配置合适的实例数和重启策略

## 文档规范

### API 文档
- 每个 API 路由必须在文件顶部注释说明功能
- 包含请求参数、响应格式、错误码

### 组件文档
- Props 必须使用 JSDoc 注释
- 复杂组件需要提供使用示例

### 更新文档
- 新功能开发完成后及时更新 `docs/` 目录
- 保持文档与代码同步
