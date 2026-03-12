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
│   └── rag-chat.md        # RAG 聊天系统
├── archive/               # 归档文档
│   └── rag-system-refactor.md
├── analytics-system-design.md        # 统计系统设计
├── collection-design.md             # 博客合集功能
├── comment-system-design.md         # 评论系统设计
├── entity-change-design.md          # 实体变更日志系统
├── mcp-oauth-design.md              # MCP OAuth 2.0 认证
├── performance-optimization-plan.md # 性能优化计划
└── permission-design.md             # 权限系统设计
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
| [RAG 聊天系统](chat/rag-chat.md) | ReAct Agent 聊天机器人 | ✅ 已实施 |

### 业务功能

| 文档 | 说明 | 状态 |
|------|------|------|
| [博客合集功能](collection-design.md) | 文章合集管理 | ✅ 已实施 |
| [评论系统](comment-system-design.md) | 评论功能设计 | ✅ 已实施 |
| [实体变更日志](entity-change-design.md) | 数据变更追踪 | ✅ 已实施 |
| [统计系统](analytics-system-design.md) | 点赞防刷 + GA4 | ✅ 已实施 |

### 基础设施

| 文档 | 说明 | 状态 |
|------|------|------|
| [权限系统](permission-design.md) | 多层权限防护 | ✅ 已实施 |
| [MCP OAuth 2.0](mcp-oauth-design.md) | MCP 服务认证 | ✅ 已实施 |
| [性能优化计划](performance-optimization-plan.md) | 性能优化实施记录 | ✅ 已完成 |

## 📋 归档文档

- [RAG 系统重构](archive/rag-system-refactor.md) - 向量化系统重构记录 (已完成)

## 🗂️ 分类说明

### vector/ - 向量化系统

包含文章向量化相关的所有设计文档：

- **overview.md**: 向量化系统的总览文档，包含整体架构、核心组件、环境配置等
- **chunking.md**: 文本切片的详细策略和实现
- **storage.md**: Qdrant 向量数据库的集成和操作
- **queue.md**: 异步队列系统的设计和实现

### search/ - 检索系统

包含基于向量的语义搜索功能：

- **semantic-search.md**: 语义搜索的实现，包含相似度检索、结果去重等

### chat/ - 聊天系统

包含基于 RAG 的 AI 聊天功能：

- **rag-chat.md**: ReAct Agent 的实现，包含工具系统、SSE 流式响应等

### archive/ - 归档文档

包含已完成或过时的设计文档，作为历史记录保留。

## 📝 文档规范

### 文档结构

每个设计文档应包含：

1. **概述** - 功能简介和核心特性
2. **架构设计** - 系统架构图和核心组件
3. **技术实现** - 详细的实现代码和说明
4. **使用指南** - API 端点和配置参数
5. **性能考虑** - 优化策略和监控指标
6. **安全考虑** - 安全措施和风险缓解
7. **扩展性** - 未来改进方向
8. **参考资料** - 相关链接

### 文档状态

| 状态 | 说明 |
|------|------|
| ✅ 已实施 | 功能已实现并上线 |
| 🔄 进行中 | 正在开发中 |
| 📋 计划中 | 已规划，待开发 |
| ⏸️ 暂停 | 暂时停止开发 |
| ❌ 已废弃 | 不再维护 |

### 相关文档引用

在文档中引用其他设计文档时，使用相对路径：

```markdown
详见：[向量化总览](vector/overview.md)
参考：[语义搜索](search/semantic-search.md)
```

## 🔗 相关资源

- [Cursor 规则](../../.cursor/rules/) - 项目开发规范
- [技术参考](../reference/) - 技术文档索引
- [计划文档](../plans/) - 开发计划

---

**最后更新**: 2026-03-12
