# React Next.js 博客系统

这是一个基于 Next.js 16 + React 19 + Prisma + MySQL 构建的全栈博客系统，包含完整的前端展示、AI 聊天、向量检索和后台管理功能。

##  技术栈

### 前端核心
- **框架**: Next.js 16 (App Router)
- **UI 库**: Ant Design 6.1
- **样式**: Tailwind CSS 4.1
- **字体**: 系统字体（无需外部加载，中国大陆友好）
- **状态管理**: React Context + Hooks
- **Markdown 编辑器**: md-editor-rt
- **Markdown 渲染**: react-markdown + remark-gfm + rehype-highlight

### 后端核心
- **ORM**: Prisma 6.2
- **数据库**: MySQL
- **缓存**: Redis (Token 管理)
- **认证**: JWT + Cookie + bcryptjs
- **文件上传**: 腾讯云 COS
- **向量数据库**: Qdrant

### AI 能力
- **聊天系统**: 基于 ReAct Agent 的 RAG 聊天机器人
- **向量化**: 文章自动向量化，支持语义搜索
- **MCP 集成**: 支持 Model Context Protocol
- **多模型支持**: Anthropic Claude、OpenAI 等

##  功能特性

### 前端功能
- **首页** - 文章列表展示，支持分页加载
- **文章详情** - Markdown 渲染，代码高亮，点赞和访问量统计
- **标签系统** - 标签列表和按标签筛选文章
- **分类系统** - 文章分类浏览
- **合集功能** - 文章合集管理
- **时间线** - 文章时间轴展示
- **归档** - 文章归档页面
- **评论系统** - 支持评论和回复
- **AI 聊天** - 基于 RAG 的智能问答
- **用户认证** - 登录/注册/GitHub OAuth
- **响应式设计** - 移动端友好

### 后台管理
- **文章管理** - 创建、编辑、删除文章，支持版本控制
- **合集管理** - 创建和管理文章合集
- **评论管理** - 评论审核和管理
- **用户管理** - 用户信息管理
- **配置管理** - 系统配置和 AI 模型配置
- **向量管理** - 向量化状态监控和手动触发
- **Token 管理** - 长期 Token 生成和管理
- **权限控制** - 基于角色的权限管理

##  快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env` 并修改配置：

```bash
cp .env.example .env
```

主要配置项：

```env
# MySQL 数据库配置
DATABASE_URL="mysql://root:password@localhost:3306/blog"

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secret
JWT_SECRET=your-secret-key

# 腾讯云 COS 配置
SecretId=your-cos-secret-id
SecretKey=your-cos-secret-key
Bucket=your-bucket-name
Region=ap-shanghai

# Qdrant 向量数据库
QDRANT_URL=http://localhost:6333
```

### 3. 初始化数据库

```bash
# 生成 Prisma 客户端
pnpm prisma:generate

# 推送 schema 到数据库
pnpm prisma:push

# （可选）打开 Prisma Studio 管理数据
pnpm prisma:studio
```

### 4. 运行开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 5. 停止开发服务器

```bash
pnpm kill
```

##  Docker 部署

### 本地开发

```bash
# 构建并启动
pnpm build:docker
pnpm start:docker

# 或使用 docker-compose
docker-compose -f docker-compose.local.yml up -d
```

### 生产部署

```bash
# 使用部署脚本（推荐）
./scripts/deploy.sh deploy

# 或使用 docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

详细文档：[Docker 部署完整指南](./docs/DOCKER_DEPLOYMENT.md)

##  默认账号

- **账号**: admin
- **密码**: admin123

##  项目结构

```
src/
├── app/                      # Next.js App Router 页面
│   ├── api/                 # API Routes
│   ├── c/                   # 后台管理页面
│   ├── chat/                # AI 聊天页面
│   ├── collections/         # 合集页面
│   ├── [year]/              # 文章详情页（日期路径）
│   ├── tags/                # 标签页面
│   ├── categories/          # 分类页面
│   └── layout.tsx           # 根布局
├── components/              # React 组件
├── contexts/                # React Context
├── dto/                     # 数据传输对象
├── entities/                # Prisma 实体
├── generated/               # Prisma 生成的客户端
├── hooks/                   # 自定义 Hooks
├── lib/                     # 工具库
├── services/                # 业务服务层
└── types/                   # TypeScript 类型定义
```

##  页面路由

### 前台页面
- `/` - 首页（文章列表）
- `/[year]/[month]/[day]/[title]` - 文章详情页
- `/tags` - 标签列表页
- `/tags/[tag]` - 按标签筛选的文章列表
- `/categories` - 分类列表页
- `/collections` - 合集列表页
- `/collections/[slug]` - 合集详情页
- `/timeline` - 时间线
- `/archives` - 归档
- `/chat` - AI 聊天
- `/login` - 登录/注册页

### 后台管理
- `/c` - 后台管理（文章列表）
- `/c/edit/new` - 创建新文章
- `/c/edit/[id]` - 编辑文章
- `/c/collections` - 合集管理
- `/c/comments` - 评论管理
- `/c/users` - 用户管理
- `/c/config` - 配置管理
- `/c/vector` - 向量管理
- `/c/tokens` - Token 管理

### API 接口
- `/api/post/*` - 文章相关接口
- `/api/user/*` - 用户认证接口
- `/api/chat/*` - AI 聊天接口
- `/api/collection/*` - 合集接口
- `/api/comment/*` - 评论接口
- `/api/fs/upload` - 文件上传
- `/api/github/*` - GitHub OAuth

##  数据库设计

### 核心表结构

- **TbPost** - 文章表（支持向量化状态追踪）
- **TbUser** - 用户表（支持 GitHub OAuth、微信登录）
- **TbConfig** - 系统配置表（AI 模型配置）
- **TbCollection** - 合集表
- **TbCollectionPost** - 合集文章关联表
- **TbComment** - 评论表（支持回复）
- **TbPostVersion** - 文章版本历史
- **LongTermToken** - 长期 Token 表

详见：[Prisma Schema](./prisma/schema.prisma)

##  AI 功能

### 向量检索
- 文章自动向量化
- 基于 Qdrant 的语义搜索
- 支持手动触发向量化

### AI 聊天
- 基于 ReAct Agent 的 RAG 聊天
- 支持多模型切换
- 工具调用可视化
- 流式响应支持

### MCP 集成
- 支持 Model Context Protocol
- OAuth 2.0 认证
- 博客合集管理

详见：[向量检索设计](./docs/designs/vector-search-design.md)、[AI 聊天系统设计](./docs/designs/chat-system-design.md)

##  权限系统

项目使用**多层权限防护**：

1. **前端 UI 控制**（仅用户体验）
2. **路由守卫**
3. **API 权限验证**（核心防护）
4. **服务层过滤**

详见：[权限系统设计](./docs/designs/permission-design.md)

##  Git 提交规范

```bash
feat(scope): 简短描述
fix(scope): 简短描述
docs(scope): 简短描述
```

详见：[Git 规范](./.cursor/rules/git-conventions.mdc)

##  开发规范

本项目使用 **Cursor IDE 规则系统** 进行开发规范管理，详细规则见 `.cursor/rules/` 目录：

- [项目概述](./.cursor/rules/project-overview.mdc)
- [目录结构](./.cursor/rules/directory-structure.mdc)
- [环境变量](./.cursor/rules/environment-variables.mdc)
- [前端开发](./.cursor/rules/frontend.mdc)
- [后端开发](./.cursor/rules/backend.mdc)
- [数据库开发](./.cursor/rules/database.mdc)
- [权限系统](./.cursor/rules/permission.mdc)
- [向量检索](./.cursor/rules/vector-search.mdc)

##  常用命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建
pnpm lint             # ESLint 检查
pnpm typecheck        # TypeScript 类型检查
pnpm kill             # 停止开发服务器

# 数据库
pnpm prisma:generate  # 生成 Prisma 客户端
pnpm prisma:push      # 推送 schema 到数据库
pnpm prisma:studio    # 打开 Prisma Studio

# 性能分析
pnpm analyze          # 运行所有分析
pnpm analyze:bundle   # 包大小分析
pnpm analyze:render   # 渲染性能分析
```

##  相关资源

### 参考项目
- [api.nnnnzs.cn](https://github.com/NNNNzs/api.nnnnzs.cn) - NestJS 后端实现
- [nnnnzs.cn](https://github.com/NNNNzs/nnnnzs.cn) - Nuxt 3 实现

### 官方文档
- [Next.js 16](https://nextjs.org/docs)
- [React 19](https://react.dev)
- [Prisma](https://www.prisma.io/docs)
- [Ant Design 6.x](https://ant.design/components)
- [Qdrant](https://qdrant.tech/documentation)

##  License

MIT
