# React Next.js 博客系统

这是一个基于 Next.js 15 + React 19 + TypeORM + MySQL 构建的全栈博客系统，包含完整的前端展示和后台管理功能。

## 📋 功能特性

### 前端功能
- ✅ **首页** - 文章列表展示，支持分页加载
- ✅ **文章详情** - Markdown 渲染，代码高亮，点赞和访问量统计
- ✅ **标签系统** - 标签列表和按标签筛选文章
- ✅ **用户认证** - 登录/注册功能
- ✅ **响应式设计** - 移动端友好

### 后台管理
- ✅ **文章管理** - 创建、编辑、删除文章
- ✅ **文章搜索** - 按标题或内容搜索
- ✅ **状态筛选** - 筛选显示/隐藏的文章
- ✅ **权限控制** - 需要登录才能访问管理后台

### 技术栈
- **框架**: Next.js 15 (App Router)
- **UI库**: Ant Design 6.0
- **样式**: Tailwind CSS 4.0
- **字体**: 系统字体（无需外部加载，中国大陆友好）
- **ORM**: TypeORM 0.3
- **数据库**: MySQL
- **缓存**: Redis (Token 管理)
- **Markdown 编辑器**: md-editor-rt
- **Markdown 渲染**: react-markdown + remark-gfm + rehype-highlight
- **文件上传**: 腾讯云 COS (cos-nodejs-sdk-v5)
- **HTTP客户端**: Axios
- **日期处理**: dayjs
- **认证**: JWT + Cookie + bcryptjs

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env` 并修改配置：

```bash
cp .env.example .env
```

配置你的数据库、Redis 和腾讯云 COS 连接信息：

```env
# MySQL 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=system

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 腾讯云 COS 配置（用于文件上传）
SecretId=your-cos-secret-id
SecretKey=your-cos-secret-key
Bucket=your-bucket-name
Region=ap-shanghai
CDN_URL=https://static.your-domain.com

# Node 环境
NODE_ENV=development
```

> **注意**: 
> 1. MySQL 数据库中已存在 `tb_post` 和 `tb_user` 表
> 2. Redis 服务已启动并可访问
> 3. 腾讯云 COS 配置用于文件上传功能（Markdown 编辑器中的图片上传）
> 4. 参考项目 `api.nnnnzs.cn` 的数据库结构创建表
> 5. 详细的 COS 配置说明请参考 [COS_UPLOAD.md](./COS_UPLOAD.md)

### 3. 运行开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 4. 构建生产版本

```bash
pnpm build
pnpm start
```

## 🐳 Docker 部署

项目支持完整的 Docker 自动化部署流程，包括 GitHub Actions 自动构建和推送到 DockerHub。

### 快速开始

1. **配置 GitHub Secrets**（首次部署）

```bash
# 使用自动化配置脚本
./scripts/setup-secrets.sh
```

2. **推送到 release 分支触发自动构建**

```bash
git checkout -b release
git push origin release
```

3. **在服务器上部署**

```bash
# 使用部署脚本（推荐）
./scripts/deploy.sh deploy

# 或使用 docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### 常用命令

```bash
# 查看日志
./scripts/deploy.sh logs

# 更新应用
./scripts/deploy.sh update

# 重启应用
./scripts/deploy.sh restart

# 回滚到上一个版本
./scripts/deploy.sh rollback
```

### 详细文档

- 📖 [Docker 部署完整指南](./docs/DOCKER_DEPLOYMENT.md)
- 🚀 [快速开始指南](./docs/QUICK_START.md)

### 部署方式对比

| 方式 | 适用场景 | 优势 |
|------|---------|------|
| **开发环境** | 本地开发 | 支持热更新，快速迭代 |
| **PM2 部署** | 单服务器生产 | 轻量级，易于管理 |
| **Docker 部署** | 容器化生产环境 | 环境隔离，易于扩展 |
| **Docker 自动化** | CI/CD 流程 | 自动构建、版本管理 |

### 版本管理

- **自动版本号**: 推送到 release 分支自动生成 `v2024.11.28-abc1234` 格式
- **手动版本号**: 创建 Git 标签 `v1.0.0` 并推送

```bash
# 使用语义化版本
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
git push origin release
```

## 📝 默认账号

- **账号**: admin
- **密码**: admin123

## 📁 项目结构

```
src/
├── app/                      # Next.js App Router 页面
│   ├── api/                 # API Routes (后端接口)
│   │   ├── post/           # 博客文章相关接口
│   │   └── user/           # 用户认证相关接口
│   ├── admin/              # 后台管理页面
│   ├── login/              # 登录页
│   ├── post/[id]/          # 文章详情页
│   ├── tags/               # 标签相关页面
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 首页
├── components/              # React 组件
│   ├── Header.tsx          # 头部导航
│   ├── Footer.tsx          # 页脚
│   ├── PostCard.tsx        # 文章卡片
│   └── Banner.tsx          # 横幅组件
├── contexts/                # React Context
│   └── AuthContext.tsx     # 认证上下文
├── entities/                # TypeORM 实体（前后端共享）
│   ├── post.entity.ts      # 文章实体
│   └── user.entity.ts      # 用户实体
├── dto/                     # 数据传输对象（前后端共享）
│   ├── post.dto.ts         # 文章 DTO
│   ├── user.dto.ts         # 用户 DTO
│   └── response.dto.ts     # 响应 DTO
├── lib/                     # 工具库
│   ├── auth.ts             # 认证工具函数
│   ├── axios.ts            # Axios 配置
│   ├── data-source.ts      # TypeORM 数据源
│   ├── redis.ts            # Redis 客户端
│   └── repositories.ts     # Repository 工厂
└── types/                   # TypeScript 类型定义
    └── index.ts            # 重新导出共享类型
```

## 🔌 API 接口

### 博客文章

- `GET /api/post/list` - 获取文章列表
- `GET /api/post/[id]` - 获取文章详情
- `POST /api/post/create` - 创建文章 (需要登录)
- `PUT /api/post/[id]` - 更新文章 (需要登录)
- `DELETE /api/post/[id]` - 删除文章 (需要登录)
- `GET /api/post/tags` - 获取所有标签
- `GET /api/post/tags/[tag]` - 根据标签获取文章
- `PUT /api/post/fav` - 更新文章统计（喜欢数/访问量）

### 用户认证

- `POST /api/user/login` - 用户登录
- `POST /api/user/register` - 用户注册
- `GET /api/user/info` - 获取用户信息 (需要登录)
- `POST /api/user/logout` - 退出登录

### 文件上传

- `POST /api/fs/upload` - 上传文件到腾讯云 COS (需要登录)

## 🎨 页面路由

本项目的路由设计完全符合原版 Nuxt.js 项目的路由结构：

### 前台页面
- `/` - 首页（文章列表）
- `/20[year]/[month]/[date]/[title]` - 文章详情页（使用日期路径，如 `/2024/12/25/my-first-post`）
- `/tags` - 标签列表页
- `/tags/[tag]` - 按标签筛选的文章列表
- `/login` - 登录/注册页

### 后台管理
- `/c` - 后台管理（文章列表）
- `/c/edit/new` - 创建新文章
- `/c/edit/[id]` - 编辑文章

> 详细的路由说明和使用示例请参考 [ROUTES.md](./ROUTES.md)

## 💡 数据库设计

### 文章表 (tb_post)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| title | varchar(255) | 标题 |
| path | varchar(255) | 路径 |
| tags | varchar(255) | 标签（逗号分隔） |
| content | text | Markdown内容 |
| description | varchar(500) | 描述 |
| cover | varchar(255) | 封面图 |
| date | datetime | 创建时间 |
| updated | datetime | 更新时间 |
| visitors | int | 访问量 |
| likes | int | 喜欢数 |
| hide | varchar(1) | 是否隐藏 |
| is_delete | int | 是否删除 |

### 用户表 (tb_user)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| account | varchar(16) | 账号 |
| password | varchar(255) | 密码（加密） |
| nickname | varchar(16) | 昵称 |
| role | varchar(20) | 角色 |
| avatar | varchar(255) | 头像 |
| mail | varchar(30) | 邮箱 |
| status | int | 状态 |

## 🎨 字体配置

本项目使用系统原生字体，无需加载外部字体文件：

- ✅ 零下载时间，即时渲染
- ✅ 中国大陆访问友好（不依赖 Google Fonts）
- ✅ 更好的中文显示效果
- ✅ 隐私保护，无外部请求

详细的字体配置说明请参考 [FONT.md](./FONT.md)

## 🔧 数据库和缓存

### TypeORM 配置

项目使用 TypeORM 作为 ORM 框架：

- **实体定义**: `src/entities/` - 使用装饰器定义数据库表结构
- **数据源配置**: `src/lib/data-source.ts` - 数据库连接配置
- **Repository**: `src/lib/repositories.ts` - 统一的 Repository 获取方法

> **注意**: 本项目使用现成的 MySQL 数据库，不会自动创建表结构。

### Redis 配置

项目使用 Redis 存储用户 Token：

- **Redis 客户端**: `src/lib/redis.ts` - Redis 连接配置和操作封装
- **Token 管理**: Token 存储在 Redis 中，格式为 `user:{token}`，有效期 7 天

## 📦 依赖包

### 核心依赖
- next: ^16.0.1
- react: ^19.2.0
- typeorm: ^0.3.27
- mysql2: ^3.15.3
- ioredis: ^5.8.2
- antd: ^6.0.0-alpha.3
- tailwindcss: ^4
- axios: ^1.13.1
- dayjs: ^1.11.18
- react-markdown: ^10.1.0
- bcryptjs: ^3.0.2
- reflect-metadata: ^0.2.2

## 🔗 参考项目

本项目参考了以下项目的设计和实现：

- [api.nnnnzs.cn](https://github.com/NNNNzs/api.nnnnzs.cn) - NestJS 后端实现
- [nnnnzs.cn](https://github.com/NNNNzs/nnnnzs.cn) - Nuxt 3 实现

## 🎯 特色功能

### 1. 前后端类型共享

实体和 DTO 定义在 `src/entities/` 和 `src/dto/` 目录中，通过 `src/types/index.ts` 重新导出，前后端可以共享相同的类型定义：

```typescript
// 后端 API 使用
import { TbPost } from '@/entities/post.entity';
import { CreatePostDto } from '@/dto/post.dto';

// 前端组件使用
import type { Post, CreatePostDto } from '@/types';
```

### 2. TypeORM Repository 模式

使用 Repository 模式统一数据库操作：

```typescript
const postRepository = await getPostRepository();
const posts = await postRepository.find({ where: { hide: '0' } });
```

### 3. Redis Token 管理

使用 Redis 存储用户 Token，替代传统的内存存储，支持分布式部署和持久化。

### 4. Markdown 编辑器

使用 `md-editor-rt` 作为 Markdown 编辑器，支持：
- 实时预览
- 代码高亮
- 图片上传（自动上传到腾讯云 COS）
- 工具栏快捷操作
- 全屏编辑

### 5. 文件上传

集成腾讯云 COS 文件上传功能：
- 支持图片上传
- 自动生成 MD5 文件名
- 返回 CDN 加速 URL
- 需要登录认证

详细的配置说明请参考 [COS_UPLOAD.md](./COS_UPLOAD.md)

## 📝 Git 提交规范

本项目采用规范化的 Git 提交信息格式，以提高代码库的可维护性和可追溯性。

### 提交格式

```
<类型>(<scope>): <描述>

<body>

<footer>
```

### 提交类型

| 类型 | 描述 | 使用场景 |
|------|------|----------|
| **feat** | 新功能 | 新增 API、UI 组件、业务功能 |
| **fix** | Bug 修复 | 修复功能缺陷、错误处理 |
| **docs** | 文档更新 | README、API 文档、注释 |
| **style** | 代码格式 | 代码格式化、命名规范 |
| **refactor** | 重构 | 代码结构调整，不影响功能 |
| **perf** | 性能优化 | 性能提升、内存优化 |
| **test** | 测试相关 | 新增测试、修复测试 |
| **chore** | 构建/工具 | 依赖更新、配置修改 |
| **ci** | CI/CD | GitHub Actions、部署脚本 |
| **build** | 构建系统 | Webpack、Vite 配置 |
| **revert** | 回退提交 | 回退之前的提交 |

### 常用 Scope

- `api`: API 路由和接口
- `auth`: 认证授权相关
- `components`: UI 组件
- `services`: 业务服务层
- `lib`: 工具库和配置
- `docker`: Docker 相关配置
- `ci`: CI/CD 流程
- `docs`: 文档相关
- `test`: 测试相关
- `react-agent`: AI 聊天代理相关

### 提交示例

```bash
# 功能开发
feat(auth): 添加 OAuth 2.0 认证支持

# Bug 修复
fix(api): 修复文章列表分页问题

# 重构
refactor(components): 优化 MarkdownPreview 组件

# 构建/工具
chore(deps): 更新依赖版本

# CI/CD
ci(docker): 优化 Docker 构建流程
```

### 复杂提交示例

```bash
feat: 重构聊天 API 以支持流式响应

- 添加 SSE 流式响应支持
- 实现 ReAct Agent 模式
- 优化工具调用可视化反馈

BREAKING CHANGE: API 响应格式变更，需要更新前端处理逻辑
Closes #123
```

### 提交规范要点

1. **标题行**: 必填，长度 ≤ 72 字符
2. **空行**: 标题和正文之间必须有空行
3. **正文**: 可选，详细描述变更内容
4. **页脚**: 可选，用于引用 issue、BREAKING CHANGE 等
5. **语言**: 使用中文描述，动词开头，首字母小写
6. **标点**: 结尾不加标点

### 使用模板

项目已配置 `.gitmessage` 提交模板，使用以下命令：

```bash
# 配置 Git 使用模板（已配置，无需重复执行）
git config --global commit.template .gitmessage

# 提交时会自动打开模板
git commit
```

详细的提交历史分析和规范制定过程，请参考 git-commit-standardizer 代理的分析结果。

## 📄 License

MIT
