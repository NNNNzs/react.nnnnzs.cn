# 路由结构说明

本项目的路由设计完全符合原版 Nuxt.js 项目的路由结构。

## 📁 路由目录结构

```
src/app/
├── page.tsx                                    # 首页
├── login/
│   └── page.tsx                               # 登录/注册页
├── tags/
│   ├── page.tsx                               # 标签列表页
│   └── [tag]/
│       └── page.tsx                           # 按标签筛选文章列表
├── 20[year]/
│   └── [month]/
│       └── [date]/
│           └── [title]/
│               └── page.tsx                   # 文章详情页（日期路径）
└── c/
    ├── page.tsx                               # 管理后台首页（文章列表）
    └── edit/
        └── [id]/
            └── page.tsx                       # 编辑/创建文章
```

## 🎯 路由对应关系

### 前台页面

| 原版 Nuxt.js 路由 | Next.js 路由 | 说明 |
|---|---|---|
| `/` | `/` | 首页（文章列表） |
| `/login` | `/login` | 登录/注册页 |
| `/tags` | `/tags` | 标签列表页 |
| `/tags/:tag` | `/tags/[tag]` | 按标签筛选文章 |
| `/20XX/MM/DD/:title` | `/20[year]/[month]/[date]/[title]` | 文章详情页 |

### 后台管理

| 原版 Nuxt.js 路由 | Next.js 路由 | 说明 |
|---|---|---|
| `/c` | `/c` | 管理后台首页 |
| `/c/edit/:id` | `/c/edit/[id]` | 编辑文章 |
| - | `/c/edit/new` | 创建新文章 |

## 🔗 路由示例

### 文章详情页

文章详情页使用日期路径，格式为 `/20[year]/[month]/[date]/[title]`：

```
/2024/12/25/my-first-post
/2023/01/01/happy-new-year
```

**实现原理：**
- `20[year]` 匹配 2000-2099 年份（如 `2024`）
- `[month]` 匹配月份（如 `12`）
- `[date]` 匹配日期（如 `25`）
- `[title]` 匹配文章标题（如 `my-first-post`）

### 标签页

```
/tags                    # 标签列表
/tags/JavaScript        # JavaScript 标签下的文章
/tags/React             # React 标签下的文章
```

### 管理后台

```
/c                      # 文章管理列表
/c/edit/new            # 创建新文章
/c/edit/123            # 编辑 ID 为 123 的文章
```

## 📝 路径生成规则

### 文章 path 字段

文章的 `path` 字段应该按照日期格式存储：

```typescript
const post = {
  id: 123,
  title: 'My First Post',
  date: '2024-12-25',
  path: '/2024/12/25/my-first-post',  // 使用日期路径
  // ...
};
```

### 从日期生成路径

```typescript
import dayjs from 'dayjs';

function generatePostPath(date: string | Date, title: string): string {
  const d = dayjs(date);
  const year = d.format('YYYY');
  const month = d.format('MM');
  const day = d.format('DD');
  const slug = encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'));
  
  return `/${year}/${month}/${day}/${slug}`;
}

// 示例
const path = generatePostPath('2024-12-25', 'My First Post');
// 输出: /2024/12/25/my-first-post
```

### 从路径解析日期和标题

```typescript
function parsePostPath(path: string): {
  year: string;
  month: string;
  date: string;
  title: string;
} {
  // 匹配格式: /20XX/MM/DD/title
  const match = path.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/(.+)$/);
  
  if (!match) {
    throw new Error('Invalid post path format');
  }
  
  return {
    year: match[1],
    month: match[2],
    date: match[3],
    title: decodeURIComponent(match[4]),
  };
}

// 示例
const { year, month, date, title } = parsePostPath('/2024/12/25/my-first-post');
// year: '2024', month: '12', date: '25', title: 'my-first-post'
```

## 🔄 路由跳转

### 组件内跳转

```typescript
import { useRouter } from 'next/navigation';

function MyComponent() {
  const router = useRouter();
  
  // 跳转到首页
  router.push('/');
  
  // 跳转到文章详情（使用 path）
  router.push(post.path); // /2024/12/25/my-first-post
  
  // 跳转到标签页
  router.push(`/tags/${tag}`);
  
  // 跳转到编辑页
  router.push(`/c/edit/${post.id}`);
  
  // 跳转到创建页
  router.push('/c/edit/new');
}
```

### Link 组件跳转

```typescript
import Link from 'next/link';

function PostCard({ post }) {
  return (
    <Link href={post.path}>
      <h2>{post.title}</h2>
    </Link>
  );
}
```

## 🎨 面包屑导航示例

```typescript
function Breadcrumb({ post }) {
  const { year, month, date, title } = parsePostPath(post.path);
  
  return (
    <nav>
      <Link href="/">首页</Link>
      <span>/</span>
      <Link href={`/${year}`}>{year}</Link>
      <span>/</span>
      <Link href={`/${year}/${month}`}>{month}</Link>
      <span>/</span>
      <Link href={`/${year}/${month}/${date}`}>{date}</Link>
      <span>/</span>
      <span>{title}</span>
    </nav>
  );
}
```

## ⚠️ 注意事项

### 1. 文章详情页查询

由于使用日期路径，需要通过 `path` 字段查询文章：

```typescript
// 在文章详情页组件中
const params = useParams();
const { year, month, date, title } = params;

// 构建路径
const path = `/20${year}/${month}/${date}/${decodeURIComponent(title)}`;

// 通过路径查询文章
const response = await axios.get('/api/post/list', {
  params: { path },
});
```

### 2. 路径编码

文章标题如果包含特殊字符，需要进行 URL 编码：

```typescript
const title = '这是中文标题';
const encodedTitle = encodeURIComponent(title);
// 使用: /2024/12/25/%E8%BF%99%E6%98%AF%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98

// 解码
const decodedTitle = decodeURIComponent(encodedTitle);
// 结果: '这是中文标题'
```

### 3. 日期格式

确保日期格式统一，建议使用 `dayjs` 库：

```typescript
import dayjs from 'dayjs';

// 格式化日期
const formattedDate = dayjs('2024-12-25').format('YYYY/MM/DD');
// 输出: '2024/12/25'
```

### 4. 404 处理

如果文章不存在，应该正确处理：

```typescript
if (!post) {
  return (
    <div>
      <h1>文章不存在</h1>
      <p>请检查链接是否正确</p>
    </div>
  );
}
```

## 📚 相关文件

- 文章详情页：`src/app/20[year]/[month]/[date]/[title]/page.tsx`
- 文章列表项：`src/components/PostListItem.tsx`
- 管理后台：`src/app/c/page.tsx`
- 编辑页面：`src/app/c/edit/[id]/page.tsx`

