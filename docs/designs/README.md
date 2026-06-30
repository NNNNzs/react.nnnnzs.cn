# 设计文档

本目录包含项目各功能模块的详细设计文档。

## 📚 目录结构

```
docs/designs/
├── vector/                # 向量化系统
│   ├── overview.md        # 向量化系统总览
│   ├── chunking.md        # 文本切片策略
│   ├── storage.md         # 向量存储 (Qdrant)
│   └── queue.md           # 向量化队列系统
├── search/                # 检索系统
│   └── semantic-search.md # 语义搜索
├── chat/                  # 聊天系统
│   └── rag-chat.md        # Agent 聊天系统（RAG 检索工具）
├── archive/               # 归档文档
│   └── rag-system-refactor.md
├── analytics-system-design.md        # 统计系统设计
├── collection-design.md             # 博客合集功能
├── comment-system-design.md         # 评论系统设计
├── day-night-style-system.md         # 站点级昼夜风格语义系统
├── entity-change-design.md          # 实体变更日志系统
├── homepage-3d-day-night.md         # 首页 3D 昼夜双主题
├── cyberpunk-homepage-room-layout.md # 首页 3D 房间布局规范
├── mcp-oauth-design.md              # MCP OAuth 2.0 认证
├── image-gen.md                     # AI 图片生成
├── task-queue.md                   # 后台任务队列系统
├── rbac-config-design.md            # 配置化 RBAC 权限系统
├── rbac-migration-inventory.md      # RBAC 迁移清单（现有权限盘点）
├── performance-optimization-plan.md # 性能优化计划
├── permission-design.md             # 权限系统设计
└── tts-page.md                      # TTS 语音合成功能
```

## 🔍 快速导航

### 向量化和检索

| 文档 | 说明 | 状态 |
|------|------|------|
| [向量化总览](vector/overview.md) | 向量化系统完整介绍 | ✅ 已实施 |
| [文本切片](vector/chunking.md) | Markdown 分块策略 | ✅ 已实施 |
| [向量存储](vector/storage.md) | Qdrant 集成和操作 | ✅ 已实施 |
| [向量化队列](vector/queue.md) | 异步队列系统 | ✅ 已实施 |
| [语义搜索](search/semantic-search.md) | 向量检索实现 | ✅ 已实施 |

### AI 系统

| 文档 | 说明 | 状态 |
|------|------|------|
| [Agent 聊天系统](chat/rag-chat.md) | LangGraph ReAct Agent 聊天机器人 + RAG 检索工具 + 聊天记录持久化 | ✅ 已实施 |

### 业务功能

| 文档 | 说明 | 状态 |
|------|------|------|
| [博客合集功能](collection-design.md) | 文章合集管理 | ✅ 已实施 |
| [评论系统](comment-system-design.md) | 评论功能设计 | ✅ 已实施 |
| [实体变更日志](entity-change-design.md) | 数据变更追踪 | ✅ 已实施 |
| [统计系统](analytics-system-design.md) | 点赞防刷 + GA4 | ✅ 已实施 |
| [TTS 语音合成](tts-page.md) | 小米 MiMo TTS 集成 | ✅ 已实施 |
| [AI 图片生成](image-gen.md) | GPT Image 2 文生图/图文编辑 | ✅ 已实施 |
| [站点级昼夜风格语义系统](day-night-style-system.md) | 日间温和文艺、夜间赛博朋克的全站视觉、文案和 `/chat` 回答风格语义系统 | 📋 计划中 |
| [首页 3D 昼夜双主题](homepage-3d-day-night.md) | 同一 3D 房间的日间文艺、夜间赛博朋克主题，以及文章列表衔接方向 | 🔄 进行中 |
| [首页 3D 房间布局规范](cyberpunk-homepage-room-layout.md) | 三视图原型与家具空间关系基准 | 🔄 进行中 |

### 基础设施

| 文档 | 说明 | 状态 |
|------|------|------|
| [权限系统](permission-design.md) | 多层权限防护（当前实现） | ✅ 已实施 |
| [配置化 RBAC](rbac-config-design.md) | 角色权限配置化 + 统一接口注册表 + MCP 自动注册 | ✅ 已实施 |
| [RBAC 迁移清单](rbac-migration-inventory.md) | 现有权限和 MCP 接口盘点，迁移对照表 | 📦 已归档 |
| [MCP OAuth 2.0](mcp-oauth-design.md) | MCP 服务认证 | ✅ 已实施 |
| [后台任务队列系统](task-queue.md) | 通用 TaskQueue、业务适配器、图片生成队列监控与重试 | ✅ 已实施 |
| [性能优化计划](performance-optimization-plan.md) | 性能优化实施记录 | ✅ 已完成 |

## 📋 归档文档

- [RAG 系统重构](archive/rag-system-refactor.md) - 向量化系统重构记录 (已完成)

## 📝 文档状态

| 状态 | 说明 |
|------|------|
| ✅ 已实施 | 功能已实现并上线 |
| 🔄 进行中 | 正在开发中 |
| 📋 计划中 | 已规划，待开发 |

## 🔗 相关资源

- [开发规范](../../docs/rules/) - 项目开发规范
- [技术参考](../reference/) - 技术文档索引
- [计划文档](../plans/) - 开发计划

---

**最后更新**: 2026-06-30
