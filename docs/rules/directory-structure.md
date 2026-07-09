# 目录结构

## 完整目录树

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (REST + MCP)
│   │   ├── post/                 # 博客文章 API
│   │   ├── user/                 # 用户认证 API
│   │   ├── ai/                   # AI 生成端点
│   │   ├── chat/                 # 聊天 API (LangGraph ReAct Agent + SSE)
│   │   │   ├── route.ts          # 聊天流式响应 + 会话落库
│   │   │   └── sessions/         # 当前用户/游客聊天会话 API
│   │   ├── admin/                # 后台管理 API
│   │   │   └── chat-logs/        # 聊天记录后台查询/删除 API
│   │   ├── tts/                  # 语音合成 API (TTS)
│   │   │   └── synthesize/       # 语音合成端点
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
│   │   ├── github/               # GitHub 集成
│   │   ├── face/                 # 人脸识别 API
│   │   │   ├── register/route.ts # 人脸注册/删除（POST/DELETE）
│   │   │   ├── login/route.ts    # 人脸登录（POST）
│   │   │   └── status/route.ts   # 人脸注册状态（GET）
│   │   └── image-gen/            # AI 图片生成 API（GPT Image 2）
│   │       └── route.ts          # 文生图/图文编辑（POST）
│   ├── .well-known/              # OAuth 发现端点
│   ├── [year]/[month]/[date]/[title]/  # 博客文章页面
│   ├── collections/[slug]/       # 合集详情页
│   ├── timeline/                 # 时间线页面
│   ├── categories/               # 分类页面
│   ├── authorize/                # OAuth 授权页面
│   ├── c/                        # 管理后台
│   │   ├── comments/             # 评论管理
│   │   ├── vector-search/        # 向量搜索管理
│   │   ├── queue/                # 后台任务队列监控
│   │   ├── collections/          # 合集管理
│   │   ├── edit/[id]/            # 文章编辑器
│   │   ├── post/                 # 文章管理
│   │   ├── user/                 # 用户管理
│   │   ├── config/               # 配置管理
│   │   ├── tts/                  # 语音合成页面 (TTS)
│   │   ├── image-gen/            # AI 图片生成页面 (GPT Image 2)
│   │   └── chat-logs/            # 聊天记录管理
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
│   ├── FaceCamera/               # 摄像头拍照组件（人脸识别）
│   ├── FaceRegistrationCard/     # 人脸注册卡片组件
│   ├── ImageGen/                 # AI 图片生成组件（GPT Image 2）
│   │   ├── ImageGenPanel.tsx     # 图片生成面板（文生图/图文编辑）
│   │   └── ImageResultCard.tsx   # 图片生成结果卡片
│   ├── agent/                    # Agent 对话消息与助手面板
│   ├── diff/                     # 文本/版本对比组件
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
│   ├── sse.ts                    # SSE 服务端推送工具
│   ├── stream-tags.ts            # XML 标签流式协议（前后端通信）
│   ├── stream.ts                 # 流式响应基础工具
│   ├── device-id.ts              # 游客聊天设备 ID 持久化
│   ├── qdrant.ts                 # Qdrant 客户端（单例+配置热更新）
│   ├── vector-db-config.ts       # 向量数据库配置（数据库驱动）
│   ├── permission.ts             # 权限检查工具
│   ├── ip.ts                     # 客户端 IP 获取
│   ├── image.ts                  # 腾讯云 CDN 图片压缩
│   ├── cos.ts                    # 腾讯云 COS 上传
│   ├── uuid.ts                   # UUID 校验工具（UUID_REGEX / isUuid）
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
│   │   │   ├── search-collection.ts  # 合集搜索工具
│   │   │   ├── langchain-tools.ts    # LangChain 格式工具定义（Function Calling）
│   │   │   └── index.ts              # 工具统一导出
│   │   ├── chat-agent/           # Chat Agent 编排服务
│   │   ├── rag/                  # 历史兼容目录 + 旧版 RAG helper
│   │   │   ├── agent.ts          # 旧 Agent 系统指令构建（保留兼容）
│   │   │   ├── langgraph-agent.ts # LangGraph ReAct Agent 实现
│   │   │   └── index.ts          # Agent 统一导出
│   │   └── utils/                # AI 提示词模板 (OpenAI)
│   ├── embedding/                # 文本嵌入服务（队列+切片+存储）
│   │   ├── embedding-queue.ts    # 异步向量化队列
│   │   ├── embedding.ts          # Embedding API 调用
│   │   ├── simple-embedder.ts    # 全量向量化编排
│   │   ├── vector-store.ts       # Qdrant 向量 CRUD
│   │   └── text-splitter.ts      # Markdown 文本分块
│   ├── queue/                    # 通用后台任务队列
│   │   └── task-queue.ts         # 并发、去重、重试、状态快照
│   ├── post.ts                   # 文章 CRUD 操作
│   ├── collection.ts             # 合集 CRUD 操作
│   ├── user.ts                   # 用户操作
│   ├── auth.ts                   # 认证服务
│   ├── comment.ts                # 评论服务
│   ├── config.ts                 # 系统配置 CRUD
│   ├── like-record.ts            # 点赞记录服务
│   ├── entity-change-detector.ts # 变更检测服务
│   ├── entity-change-log.ts      # 变更日志服务
│   ├── face.ts                   # 腾讯云人脸识别（IAI）服务
│   ├── cos-client.ts             # 腾讯云 COS 共享客户端（getCosClient / getCosBucketConfig）
│   ├── image-gen.ts              # AI 图片生成 service（GPT Image 2）
│   ├── image-gen-job.ts          # AI 图片生成异步任务（应用层 UUID jobId + 通用队列）
│   ├── chat-log.ts               # 聊天会话和消息记录服务
│   ├── mcpAuth.ts                # MCP OAuth 适配器
│   ├── token.ts                  # 长期令牌服务
│   └── post-version.ts           # 文章版本控制
│
├── hooks/                        # 自定义 React Hooks
│   ├── useBreakpoint.ts          # 响应式断点检测（管理后台移动端适配）
│   ├── useCachedApi.ts           # 带缓存的 API 请求
│   ├── useConfig.ts              # 系统配置 Hook
│   ├── useDarkMode.ts            # 暗色模式 Hook
│   ├── useAgentStream.ts         # 通用 Agent SSE 流消费
│   ├── useAssistantAgent.ts      # 业务助手场景封装
│   ├── useRouteMatch.ts          # 路由匹配 Hook
│   └── useScrollProgress.ts      # 滚动进度 Hook
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
ReAct Agent 的工具注册、定义和实现。当前包含 3 个工具，同时支持自定义格式和 LangChain 格式：
- `search_articles`: 向量语义搜索
- `search_posts_meta`: 按时间/热度/分类等维度查询
- `search_collection`: 指定合集中的文章搜索
- `langchain-tools.ts`: LangChain `tool()` + zod schema 格式的工具定义（用于 LangGraph Function Calling）

### `/src/lib` - 工具库
通用的工具函数和配置。其中 `ai-config.ts` 和 `vector-db-config.ts` 负责从数据库 `tb_config` 表读取配置。

### `/docs/plans` - 项目计划
存放项目改进计划和重构方案。

### `/docs/designs` - 功能设计文档
存放功能详细设计文档。
### `/src/components/cyberpunk` - 首页 3D 场景组件
赛博朋克首页的 3D 首屏采用“装配层 + 子组件层 + 数据层”的拆分方式，避免把房间、家具、灯光、纹理和布局全部堆在一个文件里。

#### 推荐结构
```txt
src/components/cyberpunk/
├── CyberpunkBanner.tsx      # 首页 3D 容器
├── CyberpunkLights.tsx      # 场景灯光与可见灯具
├── Room.tsx                 # 房间装配层
├── Furniture.tsx            # 家具装配层
├── sceneLayout.ts           # 场景布局数据
├── theme.ts                 # 日夜主题定义
├── room/                    # 房间结构子组件
│   ├── FloorSection.tsx
│   ├── PipeSystem.tsx
│   ├── RoomDetails.tsx
│   ├── WallSection.tsx
│   ├── WindowScene.tsx
│   ├── shared.ts
│   └── textures.ts
└── furniture/               # 家具/灯具子组件
    ├── CeilingAndFloorDetails.tsx
    ├── LivingCoreZone.tsx
    ├── MonitorModel.tsx
    ├── NeonSign.tsx
    ├── SleepZone.tsx
    ├── StorageWallZone.tsx
    ├── WardrobeZone.tsx
    ├── WorkstationZone.tsx
    └── shared.tsx
```

#### 约定
- `Room.tsx` 和 `Furniture.tsx` 只负责组合，不承载大段几何实现。
- `room/` 目录只放房间结构、窗景、地板、墙面和纹理生成逻辑。
- `furniture/` 目录只放家具、屏幕、霓虹、线缆等可独立维护的模型。
- 需要共享的尺寸、材质、贴图生成器优先抽到同目录 `shared` 文件中。
- 主题切换和全局光照基准优先写到 `theme.ts`，物体尺寸和空间坐标优先写到 `sceneLayout.ts`。
- 真实发光物体必须把“可见发光体”和“实际光源”封装在同一个组件里一起创建，例如显示器屏幕、服务器 LED/灯条、霓虹招牌、天花灯带和桌灯。
- `CyberpunkLights.tsx` 只负责全局环境光、窗外/天空方向光、不可见补光和少量确实属于房间结构的公共灯具，不应为具体家具额外创建可见小灯。
- 不可见补光必须明确命名或注释为 fill/bounce/window light，并保持 `visibleFixture={false}` 或直接使用不可见 light primitive，避免被误认为房间里的物件。
- 纯装饰 emissive 片、HUD 光点、状态点可以 mesh-only；一旦承担照明语义，就要和 `pointLight` / `spotLight` 封装到同一个物件组件中。
- 灯具组件优先按 `*Fixture` / `*Light` / `*Lamp` 这类语义命名，组件内部统一负责位置、模型、发光材质和实际光源。
