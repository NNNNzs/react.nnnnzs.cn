# 前端开发规范

## 框架和工具

### Next.js App Router
- **版本**: Next.js 16.0.8
- **路由系统**: 使用 App Router (`src/app/`)
- **路由约定**:
  - `page.tsx`: 页面组件
  - `layout.tsx`: 布局组件
  - `loading.tsx`: 加载状态
  - `error.tsx`: 错误处理
  - `not-found.tsx`: 404 页面

### React 规范
- **版本**: React 19.2.1
- **组件类型**: 优先使用函数式组件
- **Hooks 使用**:
  - 遵循 Hooks 规则，不在条件语句中调用
  - 使用 `useMemo` 缓存计算结果
  - 使用 `useCallback` 缓存回调函数
  - 使用 `useEffect` 处理副作用

### 客户端 vs 服务端组件

#### 服务端组件 (默认)
- 默认所有组件都是服务端组件
- 可以直接访问数据库和服务端资源
- 不能使用浏览器 API 和 React Hooks
- 适用场景:
  - 数据获取
  - 访问后端资源
  - SEO 优化的页面

```typescript
// src/app/page.tsx - 服务端组件
export default async function HomePage() {
  // 可以直接查询数据库
  const posts = await getPosts()

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

#### 客户端组件
- 必须在文件顶部使用 `'use client'` 指令
- 可以使用 React Hooks 和浏览器 API
- 不能直接访问数据库
- 适用场景:
  - 交互式 UI
  - 使用 React Hooks
  - 使用浏览器 API
  - 事件监听器

```typescript
// src/components/Header.tsx - 客户端组件
'use client'

import { useState } from 'react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header onClick={() => setIsOpen(!isOpen)}>
      {/* 交互式内容 */}
    </header>
  )
}
```

## UI 组件库规范

### Ant Design
- **版本**: 6.1.0
- **配置**: 使用 `ConfigProvider` 全局配置
- **主题**: 使用 `ConfigProvider` 配置主题色
- **国际化**: 使用 `zhCN` 中文语言包

```typescript
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

<ConfigProvider locale={zhCN}>
  {children}
</ConfigProvider>
```

#### 常用组件
- **表单**: `Form`, `Input`, `Select`, `DatePicker`
- **数据展示**: `Table`, `Card`, `List`, `Avatar`
- **反馈**: `Message`, `Modal`, `Notification`
- **导航**: `Menu`, `Dropdown`, `Breadcrumb`

#### 组件使用规范
```typescript
import { Button, Form, Input, message } from 'antd'

// ✅ 正确 - 按需导入
const LoginForm = () => {
  const [form] = Form.useForm()

  const onFinish = async (values: LoginFormValues) => {
    try {
      await login(values)
      message.success('登录成功')
    } catch (error) {
      message.error('登录失败')
    }
  }

  return (
    <Form form={form} onFinish={onFinish}>
      <Form.Item name="account" rules={[{ required: true }]}>
        <Input placeholder="请输入账号" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          登录
        </Button>
      </Form.Item>
    </Form>
  )
}
```

### Tailwind CSS
- **版本**: 4.1.17
- **配置**: `tailwind.config.js`
- **使用场景**:
  - 布局和间距
  - 响应式设计
  - 自定义样式
  - 暗色模式

#### 响应式设计
```typescript
// 使用 Tailwind 断点
<div className="
  w-full          // 移动端全宽
  md:w-1/2        // 平板半宽
  lg:w-1/3        // 桌面三分之一
  px-4 md:px-6    // 响应式内边距
">
  内容
</div>
```

#### 暗色模式
```typescript
// 使用 dark: 前缀
<div className="
  bg-white dark:bg-slate-800
  text-slate-900 dark:text-white
  border-gray-200 dark:border-gray-700
">
  内容
</div>
```

## 状态管理

### Context API
- 全局状态使用 React Context
- 示例: `AuthContext` 管理用户认证状态

```typescript
// src/contexts/AuthContext.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  login: (account: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  // 实现认证逻辑

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### 本地状态
- 组件内部状态使用 `useState`
- 表单状态使用 Ant Design 的 `Form.useForm()`

## 数据获取

### 服务端数据获取
```typescript
// src/app/posts/page.tsx
import { getPosts } from '@/services/post'

export default async function PostsPage() {
  // 直接在服务端组件中获取数据
  const posts = await getPosts()

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

### 客户端数据获取
```typescript
// src/components/PostList.tsx
'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

export default function PostList() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await axios.get('/api/post/list')
        if (response.data.status) {
          setPosts(response.data.data.record)
        }
      } catch (error) {
        console.error('获取文章列表失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  if (loading) return <div>加载中...</div>

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

## 样式规范

### 优先级
1. **Tailwind CSS**: 布局、间距、颜色、响应式
2. **Ant Design**: UI 组件默认样式
3. **CSS Modules**: 复杂自定义样式

### Tailwind 使用建议
```typescript
// ✅ 推荐 - 使用 Tailwind 工具类
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  内容
</div>

// ❌ 避免 - 不要为简单样式写 CSS
<div className={styles.container}>
  内容
</div>
```

### 响应式设计断点
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## 路由和导航

### Link 组件
```typescript
import Link from 'next/link'

// ✅ 正确 - 使用 Next.js Link
<Link href="/posts">文章列表</Link>

// ❌ 错误 - 不要使用 <a> 标签
<a href="/posts">文章列表</a>
```

### 路由参数
```typescript
// 动态路由: src/app/[year]/[month]/[date]/[title]/page.tsx
interface PageProps {
  params: Promise<{
    year: string
    month: string
    date: string
    title: string
  }>
}

export default async function PostPage({ params }: PageProps) {
  const { year, month, date, title } = await params
  const path = `/${year}/${month}/${date}/${title}`

  // 使用路径获取文章
  const post = await getPostByPath(path)

  return <div>{post.title}</div>
}
```

### useRouter Hook
```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function LoginButton() {
  const router = useRouter()

  const handleLogin = async () => {
    await login()
    router.push('/dashboard')
    // 或者刷新数据
    router.refresh()
  }

  return <button onClick={handleLogin}>登录</button>
}
```

## 性能优化

### 图片优化
```typescript
import Image from 'next/image'

// ✅ 使用 Next.js Image 组件
<Image
  src="/avatar.jpg"
  alt="头像"
  width={100}
  height={100}
  priority // 首屏图片使用 priority
/>
```

### 代码分割
```typescript
import dynamic from 'next/dynamic'

// 懒加载组件
const MarkdownEditor = dynamic(
  () => import('@/components/MarkdownEditor'),
  {
    ssr: false, // 禁用 SSR
    loading: () => <div>加载中...</div>
  }
)
```

### React 优化
```typescript
import { memo, useMemo, useCallback } from 'react'

// 使用 memo 避免不必要的重新渲染
const PostCard = memo(({ post }: { post: Post }) => {
  return <div>{post.title}</div>
})

// 使用 useMemo 缓存计算结果
const ExpensiveComponent = ({ data }: { data: Data[] }) => {
  const processedData = useMemo(() => {
    return data.map(item => processExpensive(item))
  }, [data])

  return <div>{processedData}</div>
}

// 使用 useCallback 缓存回调函数
const ParentComponent = () => {
  const [count, setCount] = useState(0)

  const handleClick = useCallback(() => {
    setCount(c => c + 1)
  }, [])

  return <ChildComponent onClick={handleClick} />
}
```

## 表单处理

### Ant Design Form
```typescript
'use client'

import { Form, Input, Button, message } from 'antd'

interface FormValues {
  title: string
  content: string
}

export default function PostForm() {
  const [form] = Form.useForm<FormValues>()

  const onFinish = async (values: FormValues) => {
    try {
      const response = await axios.post('/api/post/create', values)
      if (response.data.status) {
        message.success('创建成功')
        form.resetFields()
      } else {
        message.error(response.data.message)
      }
    } catch (error) {
      message.error('创建失败')
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
    >
      <Form.Item
        name="title"
        label="标题"
        rules={[
          { required: true, message: '请输入标题' },
          { max: 100, message: '标题不能超过100个字符' }
        ]}
      >
        <Input placeholder="请输入标题" />
      </Form.Item>

      <Form.Item
        name="content"
        label="内容"
        rules={[{ required: true, message: '请输入内容' }]}
      >
        <Input.TextArea rows={10} placeholder="请输入内容" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          提交
        </Button>
      </Form.Item>
    </Form>
  )
}
```

## 错误处理

### 全局错误边界
```typescript
// src/app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>出错了!</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>重试</button>
    </div>
  )
}
```

### API 错误处理
```typescript
try {
  const response = await axios.get('/api/user/info')
  if (response.data.status) {
    setUser(response.data.data)
  } else {
    message.error(response.data.message || '获取用户信息失败')
  }
} catch (error) {
  if (axios.isAxiosError(error)) {
    message.error(error.response?.data?.message || '请求失败')
  } else {
    message.error('发生未知错误')
  }
}
```

## SEO 优化

### Metadata
```typescript
// src/app/posts/[id]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPostById(params.id)

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      images: [post.cover],
    },
  }
}
```

## 测试规范

### 组件测试建议
- 测试用户交互
- 测试条件渲染
- 测试表单提交
- 避免测试实现细节

## 注意事项

### 服务端组件限制
- 不能使用 `useState`, `useEffect` 等 Hooks
- 不能使用浏览器 API
- 不能使用事件监听器

### 客户端组件限制
- 不能直接访问数据库
- 不能直接使用 Prisma Client
- 必须通过 API 路由获取数据

### Next.js 16 新特性
- React 19 支持
- 改进的缓存策略
- 更好的 Turbopack 支持

### 常见陷阱
- 避免在客户端组件中使用大型库
- 避免过度使用客户端组件
- 注意 hydration 错误
- 合理使用缓存策略
