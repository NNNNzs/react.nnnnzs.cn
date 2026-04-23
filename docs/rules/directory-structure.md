# 目录结构

## 完整目录树

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (REST + MCP)
│   │   ├── post/                 # 博客文章 API
│   │   ├── user/                 # 用户认证 API
│   │   ├── ai/                   # AI 生成端点
│   │   ├── chat/                 # 聊天 API (ReAct Agent + SSE)
│   │   ├── mcp/                  # Model Context Protocol
│   │   ├── oauth/                # OAuth 2.0 端点
│   │   ├── comment/              # 评论 API
│   │   ├── entity-change/        # 实体变更日志 API
│   │   ├── fs/                   # 文件系统 API（上传/代理）
│   │   ├── collections/          # 合集管理 API
│   │   ├── config/               # 系统配置 API
│   │   ├── health/               # 健康检查 API
│   │   ├── search/               # 搜索 API
│   │   ├── wechat/               # 微信集成 API
│   │   └── github/               # GitHub 集成
│   ├── .well-known/              # OAuth 发现端点
│   ├── [year]/[month]/[date]/[title]/  # 博客文章页面
│   ├── collections/[slug]/       # 合集详情页
│   ├── timeline/                 # 时间线页面
│   ├── categories/               # 分类页面
│   ├── authorize/                # OAuth 授权页面
│   ├── c/                        # 管理后台
│   │   ├── comments/             # 评论管理
│   │   ├── vector-search/        # 向量搜索管理
│   │   ├── queue/                # 向量化队列管理
│   │   ├── collections/          # 合集管理
│   │   ├── edit/[id]/            # 文章编辑器
│   │   ├── post/                 # 文章管理
│   │   ├── user/                 # 用户管理
│   │   └── config/               # 配置管理
│   ├── tags/                     # 标签页面
│   ├── archives/                 # 归档页面
│   ├── chat/                     # AI 聊天界面
│   └── login/                    # 认证页面
│
├── components/                   # React 组件
│   ├── MediaUpload/              # 媒体上传组件（支持图片/视频/裁剪）
│   ├── AITextProcessor/          # AI 文本处理 UI
│   ├── CollectionCard/           # 合集卡片组件
│   ├── ArticleCollections/       # 文章的合集
│   ├── CollectionSelector/       # 文章的合集选择器
│   ├── CommentSection/           # 评论展示组件
│   ├── EntityChangeHistoryModal/ # 变更历史弹窗
│   ├── PostLikeButton/           # 文章点赞按钮
│   ├── CollectionLikeButton/     # 合集点赞按钮
│   └── (shared UI components)    # 其他共享组件
│
├── contexts/                     # React Contexts
│   ├── AuthContext.tsx           # 认证状态
│   ├── CurrentPostContext.tsx    # 当前文章状态
│   └── HeaderStyleContext.tsx    # 头部样式
│
├── dto/                          # 数据传输对象 (共享类型)
│   ├── post.dto.ts               # 文章数据类型
│   ├── user.dto.ts               # 用户数据类型
│   ├── config.dto.ts             # 配置数据类型
│   ├── collection.dto.ts         # 合集数据类型
│   ├── comment.dto.ts            # 评论数据类型
│   └── response.dto.ts           # API 响应格式
│
├── lib/                          # 核心工具库
│   ├── auth.ts                   # 认证工具（Token 生成/验证）
│   ├── redis.ts                  # Redis 客户端和服务
│   ├── prisma.ts                 # Prisma 客户端包装（单例）
│   ├── long-term-token-auth.ts   # LTK 认证中间件（withAuth）
│   ├── ai.ts                     # OpenAI LangChain 抽象层
│   ├── ai-config.ts              # AI 配置管理（数据库驱动）
│   ├── ai-text.ts                # AI 文本处理工具函数
│   ├── react-agent.ts            # ReAct Agent 核心逻辑
│   ├── qdrant.ts                 # Qdrant 客户端（单例+配置热更新）
│   ├── vector-db-config.ts       # 向量数据库配置（数据库驱动）
│   ├── permission.ts             # 权限检查工具
│   ├── ip.ts                     # 客户端 IP 获取
│   ├── image.ts                  # 腾讯云 CDN 图片压缩
│   ├── cos.ts                    # 腾讯云 COS 上传
│   └── (其他工具函数)
│
├── services/                     # 业务逻辑层
│   ├── ai/                       # AI 服务
│   │   ├── anthropic/            # Anthropic SDK 包装
│   │   ├── description/          # 文章描述生成
│   │   ├── text/                 # 文本处理
│   │   ├── tools/                # ReAct Agent 工具注册和实现
│   │   │   ├── search-articles.ts    # 向量语义搜索工具
│   │   │   ├── search-posts-meta.ts  # 元数据搜索工具
│   │   │   └── search-collection.ts  # 合集搜索工具
│   │   ├── rag/                  # RAG Agent 服务
│   │   │   └── agent.ts          # Agent 系统指令构建
│   │   └── utils/                # AI 提示词模板 (OpenAI)
│   ├── embedding/                # 文本嵌入服务（队列+切片+存储）
│   │   ├── embedding-queue.ts    # 异步向量化队列
│   │   ├── embedding.ts          # Embedding API 调用
│   │   ├── simple-embedder.ts    # 全量向量化编排
│   │   ├── vector-store.ts       # Qdrant 向量 CRUD
│   │   └── text-splitter.ts      # Markdown 文本分块
│   ├── post.ts                   # 文章 CRUD 操作
│   ├── collection.ts             # 合集 CRUD 操作
│   ├── user.ts                   # 用户操作
│   ├── auth.ts                   # 认证服务
│   ├── comment.ts                # 评论服务
│   ├── config.ts                 # 系统配置 CRUD
│   ├── like-record.ts            # 点赞记录服务
│   ├── entity-change-detector.ts # 变更检测服务
│   ├── entity-change-log.ts      # 变更日志服务
│   ├── mcpAuth.ts                # MCP OAuth 适配器
│   ├── token.ts                  # 长期令牌服务
│   └── post-version.ts           # 文章版本控制
│
├── hooks/                        # 自定义 React Hooks
├── types/                        # TypeScript 类型定义 (重新导出)
├── config/                       # 项目配置常量
├── generated/                    # 自动生成的代码（Prisma Client）
└── style/                        # 全局样式

docs/                             # 项目文档
├── plans/                        # 项目计划列表
├── designs/                      # 功能详细设计文档
└── rules/                        # 开发规范文档

prisma/                           # Prisma Schema 定义
```

## 目录职责说明

### `/src/app/api` - API 路由
所有 API 端点，遵循 RESTful 规范。

### `/src/services` - 业务逻辑层
核心业务逻辑，所有数据库操作通过此层进行。

### `/src/services/ai/tools` - AI 工具系统
ReAct Agent 的工具注册、定义和实现。当前包含 3 个工具：
- `search_articles`: 向量语义搜索
- `search_posts_meta`: 按时间/热度/分类等维度查询
- `search_collection`: 指定合集中的文章搜索

### `/src/lib` - 工具库
通用的工具函数和配置。其中 `ai-config.ts` 和 `vector-db-config.ts` 负责从数据库 `tb_config` 表读取配置。

### `/docs/plans` - 项目计划
存放项目改进计划和重构方案。

### `/docs/designs` - 功能设计文档
存放功能详细设计文档。
