# CLAUDE.md

本项目使用 **Cursor IDE 规则系统** 进行开发规范管理。所有详细规则已拆分到 `.cursor/rules/` 目录下，本文档仅作为快速索引。

## 📁 规则文档目录

### 项目基础
- **[项目概述](.cursor/rules/project-overview.mdc)** - 技术栈、框架版本
- **[目录结构](.cursor/rules/directory-structure.mdc)** - 完整目录树和职责说明
- **[环境变量](.cursor/rules/environment-variables.mdc)** - 配置规范和必需变量
- **[包管理](.cursor/rules/package-management.mdc)** - pnpm 使用和常用命令
- **[Git 规范](.cursor/rules/git-conventions.mdc)** - Commit 格式和分支策略
- **[代码风格](.cursor/rules/code-style.mdc)** - 命名规范、TypeScript 规范、注释规范

### 开发规范
- **[前端开发](.cursor/rules/frontend.mdc)** - Next.js App Router、React 19、Ant Design 6.x
- **[后端开发](.cursor/rules/backend.mdc)** - API 路由、服务层、AI 工具选择
- **[数据库开发](.cursor/rules/database.mdc)** - Prisma Schema、迁移、查询优化
- **[权限系统](.cursor/rules/permission.mdc)** - 多层权限防护、角色定义、API 权限检查

### 功能模块
- **[向量检索](.cursor/rules/vector-search.mdc)** - 文章向量化、语义搜索、Qdrant 集成

### 项目管理
- **[计划管理](.cursor/rules/plans-management.mdc)** - 计划文档生命周期、完成后处理流程

## 📂 设计文档目录

详见：[docs/designs/README.md](docs/designs/README.md)

### 可用设计文档

#### 性能优化
- **[性能优化计划](docs/designs/performance-optimization-plan.md)** - 性能优化实施记录
- **开发时使用**: `/vercel-react-best-practices` skill

#### 向量检索与向量化
- **[向量化总览](docs/designs/vector/overview.md)** - 向量化系统完整介绍
- **[文本切片](docs/designs/vector/chunking.md)** - Markdown 分块策略
- **[向量存储](docs/designs/vector/storage.md)** - Qdrant 集成和操作
- **[向量化队列](docs/designs/vector/queue.md)** - 异步队列系统
- **[语义搜索](docs/designs/search/semantic-search.md)** - 向量检索实现

#### AI 对话系统
- **[RAG 聊天系统](docs/designs/chat/rag-chat.md)** - 基于 ReAct Agent 的 RAG 聊天机器人

#### 权限与认证
- **[权限系统设计](docs/designs/permission-design.md)** - 多层权限防护架构
- **[MCP OAuth 2.0 认证设计](docs/designs/mcp-oauth-design.md)** - MCP 服务 OAuth 2.0 集成

#### 内容管理
- **[博客合集功能设计](docs/designs/collection-design.md)** - 文章合集管理功能

#### 基础设施
- **[队列系统](docs/designs/vector/queue.md)** - 异步任务队列系统（已整合到向量化模块）

## 📋 计划文档目录

详见：[docs/plans/README.md](docs/plans/README.md)

### 当前计划
- **[聊天系统简化](docs/plans/chat-system-simplification.md)** - 从 ReAct 到简单 RAG（计划中）

### 已完成计划
- 已归档到 `docs/designs/` 目录

## 📖 技术参考目录

详见：`docs/reference/`

### 技术参考文档
- **[路由结构说明](docs/reference/ROUTES.md)** - 路由设计参考
- **[队列调试指南](docs/reference/QUEUE-DEBUG-GUIDE.md)** - 向量化队列调试
- **[Prisma 版本说明](docs/reference/PRISMA_VERSION_NOTE.md)** - Prisma 相关技术说明
- **[MCP 合集使用指南](docs/reference/mcp-collections-guide.md)** - MCP 合集功能使用指南

## 🚀 快速开始

### 首次使用
1. 阅读 [项目概述](.cursor/rules/project-overview.mdc) 了解技术栈
2. 阅读 [目录结构](.cursor/rules/directory-structure.mdc) 了解代码组织
3. 配置环境变量（参考 [环境变量](.cursor/rules/environment-variables.mdc)）
4. 运行 `pnpm install` 安装依赖
5. 运行 `pnpm dev` 启动开发服务器

### 日常开发
- **前端开发**: 参考 [前端开发规范](.cursor/rules/frontend.mdc)
- **后端开发**: 参考 [后端开发规范](.cursor/rules/backend.mdc)
- **API 开发**: 参考 [权限系统](.cursor/rules/permission.mdc) 确保安全
- **数据库变更**: 参考 [数据库规范](.cursor/rules/database.mdc)

### Git 提交
参考 [Git 规范](.cursor/rules/git-conventions.mdc)：
```bash
feat(scope): 简短描述
fix(scope): 简短描述
```

### 计划管理
参考 [计划管理规范](.cursor/rules/plans-management.mdc)：
- 计划完成后及时清理或移至设计文档
- 保持 `docs/plans/` 目录整洁

## 🔑 核心概念

### 权限系统
项目使用**多层权限防护**，所有 API 必须实现权限验证：
- 前端 UI 控制（仅用户体验）
- 路由守卫
- **API 权限验证**（核心防护）
- 服务层过滤

详见：[权限系统](.cursor/rules/permission.mdc)

### 管理后台布局
管理后台页面使用 `overflow-hidden` 固定高度，需遵循特定的 flex 布局：
```tsx
<div className="w-full h-full flex flex-col">
  <div className="flex-1 flex flex-col min-h-0">
    <div className="shrink-0">固定头部</div>
    <div className="flex-1 min-h-0">可滚动内容</div>
  </div>
</div>
```

详见：[前端开发规范](.cursor/rules/frontend.mdc)

### AI 工具选择
根据模型提供商选择对应工具：
- **Anthropic Claude**: `@anthropic-ai/sdk`（官方 SDK）
- **OpenAI**: `@langchain/openai`（LangChain 包装）

详见：[后端开发规范](.cursor/rules/backend.mdc)

## 📝 文档约定

### Cursor 规则文件
- 格式：MDC (Markdown with frontmatter)
- 位置：`.cursor/rules/*.mdc`
- 作用：自动化规范检查、AI 辅助编码

### 设计文档
- 位置：`docs/designs/*.md`
- 作用：长期参考的技术文档
- 内容：架构设计、技术决策、代码示例

### 计划文档
- 位置：`docs/plans/*.md`
- 作用：临时性的实施方案
- 生命周期：计划中 → 进行中 → 已完成 → **清理/归档**

## 🛠️ 常用命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建
pnpm lint             # ESLint 检查
pnpm typecheck        # TypeScript 类型检查

# 数据库
pnpm prisma:generate  # 生成 Prisma 客户端
pnpm prisma:push      # 推送 schema 到数据库（开发）
pnpm prisma:studio    # 打开 Prisma Studio

# 性能分析
pnpm analyze          # 运行所有分析
pnpm analyze:bundle   # 包大小分析
```
**重要** 在后台```npm run dev``` 启动了服务，任务完成后，要kill掉杀死，而不是一直挂着，影响我看日志

更多命令：[包管理](.cursor/rules/package-management.mdc)

## ⚠️ 重要提示

### 项目结构变更
当涉及目录结构或架构变更时，**必须**同步更新规范文件：
1. 更新受影响的 `.cursor/rules/*.mdc` 文件
2. 在 commit message 中注明规范文件更新

详见：[Git 规范](.cursor/rules/git-conventions.mdc)

### 计划完成后处理
计划状态变为 **✅ 已完成** 时，**必须**执行清理：
- 有价值的计划 → 移至 `docs/designs/`
- 无价值的计划 → 删除
- 更新 `docs/plans/README.md`

详见：[计划管理](.cursor/rules/plans-management.mdc)

### TypeScript 严格模式
项目已启用严格模式：
- 禁止使用 `any`
- 必须明确类型定义
- 使用 `unknown` 代替 `any`

详见：[代码风格](.cursor/rules/code-style.mdc)

## 🔗 相关资源

### 官方文档
- [Next.js 16](https://nextjs.org/docs)
- [React 19](https://react.dev)
- [Prisma](https://www.prisma.io/docs)
- [Ant Design 6.x](https://ant.design/components)
- [Cursor IDE](https://cursor.sh)

## MCP
当我让你把功能、总结、计划等内容添加到博客的时候，请使用```MyBlog``` MCP 工具添加，默认添加到合集```小破站建设```

---

**使用中文回答问题** - 所有开发规范、注释和文档均使用中文。
**回答称呼** 在所有回答结束之后称呼我`站长`
技术术语保持英文原样（如 Next.js, TypeScript, Prisma）。