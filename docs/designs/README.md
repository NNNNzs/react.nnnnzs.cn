# 设计文档

本目录包含项目各功能模块的详细设计文档。

## 📚 目录结构

```
docs/designs/
├── ai/                          # AI 系统
│   ├── ai-config-profiles.md    # AI Provider 配置管理
│   ├── ai-lab.md                # AI Lab / LLM 学习实验台
│   ├── image-gen.md             # AI 图片生成
│   └── tts-page.md              # TTS 语音合成
├── chat/                        # 聊天系统
│   └── rag-chat.md              # Agent 聊天系统（RAG 检索工具）
├── features/                    # 业务功能
│   ├── collection-design.md     # 博客合集功能
│   ├── comment-system-design.md # 评论系统设计
│   ├── content-creation-platform.md # 内容创作中台
│   ├── entity-change-design.md  # 实体变更日志系统
│   └── analytics-system-design.md # 统计系统设计
├── homepage/                    # 首页与风格
│   ├── homepage-3d-day-night.md         # 首页 3D 昼夜双主题
│   ├── cyberpunk-homepage-room-layout.md # 首页 3D 房间布局规范
│   └── day-night-style-system.md        # 站点级昼夜风格语义系统
├── infra/                       # 基础设施
│   ├── permission-design.md     # 权限系统设计
│   ├── rbac-config-design.md    # 配置化 RBAC 权限系统
│   ├── rbac-migration-inventory.md # RBAC 迁移清单
│   ├── mcp-oauth-design.md      # MCP OAuth 2.0 认证
│   ├── open-platform-oauth-integration.md # 开放平台 OAuth 集成
│   ├── task-queue.md            # 后台任务队列系统
│   └── performance-optimization-plan.md # 性能优化计划
├── search/                      # 检索系统
│   └── semantic-search.md       # 语义搜索
├── vector/                      # 向量化系统
│   ├── overview.md              # 向量化系统总览
│   ├── chunking.md              # 文本切片策略
│   ├── storage.md               # 向量存储 (Qdrant)
│   └── queue.md                 # 向量化队列系统
└── archive/                     # 归档文档
    ├── rag-system-refactor.md
    ├── chat-langchain-migration.md
    └── admin-mobile-ux.md
```

## 🔍 快速导航

### AI 系统

| 文档 | 说明 | 状态 |
|------|------|------|
| [AI Provider 配置管理](ai/ai-config-profiles.md) | Provider、模型清单和场景绑定配置 | 🚧 执行中 |
| [AI Lab / LLM 学习实验台](ai/ai-lab.md) | Run 观测、RAG 评测、系统级 Prompt / Skill 模板、检索实验与 LangSmith 集成设计 | 🚧 执行中 |
| [TTS 语音合成](ai/tts-page.md) | 小米 MiMo TTS 集成 | ✅ 已实施 |
| [AI 图片生成](ai/image-gen.md) | GPT Image 2 文生图/图文编辑 | ✅ 已实施 |
| [草稿库创作 Agent 助手](ai/create-agent.md) | LangGraph ReAct Agent + SSE 多事件流 + 草稿回填（方案 B） | ✅ 已落地 |

### 聊天系统

| 文档 | 说明 | 状态 |
|------|------|------|
| [Agent 聊天系统](chat/rag-chat.md) | LangGraph ReAct Agent 聊天机器人 + RAG 检索工具 + 聊天记录持久化 | ✅ 已实施 |

### 向量化和检索

| 文档 | 说明 | 状态 |
|------|------|------|
| [向量化总览](vector/overview.md) | 向量化系统完整介绍 | ✅ 已实施 |
| [文本切片](vector/chunking.md) | Markdown 分块策略 | ✅ 已实施 |
| [向量存储](vector/storage.md) | Qdrant 集成和操作 | ✅ 已实施 |
| [向量化队列](vector/queue.md) | 异步队列系统 | ✅ 已实施 |
| [语义搜索](search/semantic-search.md) | 向量检索实现 | ✅ 已实施 |

### 业务功能

| 文档 | 说明 | 状态 |
|------|------|------|
| [博客合集功能](features/collection-design.md) | 文章合集管理 | ✅ 已实施 |
| [评论系统](features/comment-system-design.md) | 评论功能设计 | ✅ 已实施 |
| [内容创作中台](features/content-creation-platform.md) | 独立 `/create` 创作后台，整合博客文章与 xhs 本地工作流；当前只做登录守卫，内容权限后置 | 🔄 进行中 |
| [实体变更日志](features/entity-change-design.md) | 数据变更追踪 | ✅ 已实施 |
| [统计系统](features/analytics-system-design.md) | 点赞防刷 + GA4 | ✅ 已实施 |

### 首页与风格

| 文档 | 说明 | 状态 |
|------|------|------|
| [站点级昼夜风格语义系统](homepage/day-night-style-system.md) | 日间温和文艺、夜间赛博朋克的全站视觉、文案和 `/chat` 回答风格语义系统 | 📋 计划中 |
| [首页 3D 昼夜双主题](homepage/homepage-3d-day-night.md) | 同一 3D 房间的日间文艺、夜间赛博朋克主题，以及文章列表衔接方向 | 🔄 进行中 |
| [首页 3D 房间布局规范](homepage/cyberpunk-homepage-room-layout.md) | 三视图原型与家具空间关系基准 | 🔄 进行中 |

### 基础设施

| 文档 | 说明 | 状态 |
|------|------|------|
| [权限系统](infra/permission-design.md) | 多层权限防护（当前实现） | ✅ 已实施 |
| [配置化 RBAC](infra/rbac-config-design.md) | 角色权限配置化 + 统一接口注册表 + MCP 自动注册 | ✅ 已实施 |
| [RBAC 迁移清单](infra/rbac-migration-inventory.md) | 现有权限和 MCP 接口盘点，迁移对照表 | 📦 已归档 |
| [MCP OAuth 2.0](infra/mcp-oauth-design.md) | MCP 服务认证 | ✅ 已实施 |
| [开放平台 OAuth 集成](infra/open-platform-oauth-integration.md) | 第三方应用 OAuth 接入 | ✅ 已实施 |
| [后台任务队列系统](infra/task-queue.md) | 通用 TaskQueue、业务适配器、图片生成队列监控与重试 | ✅ 已实施 |
| [性能优化计划](infra/performance-optimization-plan.md) | 性能优化实施记录 | ✅ 已完成 |

## 📋 归档文档

- [RAG 系统重构](archive/rag-system-refactor.md) - 向量化系统重构记录 (已完成)
- [LangChain/LangGraph 迁移](archive/chat-langchain-migration.md) - 聊天系统迁移至 LangGraph
- [管理后台移动端适配](archive/admin-mobile-ux.md) - 响应式 Sider/Drawer 切换

## 📝 文档状态

| 状态 | 说明 |
|------|------|
| ✅ 已实施 | 功能已实现并上线 |
| 🔄 进行中 | 正在开发中 |
| 📋 计划中 | 已规划，待开发 |
| 📦 已归档 | 已完成并归档 |

## 🔗 相关资源

- [开发规范](../rules/) - 项目开发规范
- [技术参考](../reference/) - 技术文档索引
- [计划文档](../plans/) - 开发计划

---

**最后更新**: 2026-07-07
