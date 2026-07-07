# CLAUDE.md

本项目使用 **开发规范文档系统** 进行开发规范管理。所有详细规则已拆分到 `docs/rules/` 目录下，本文档仅作为快速索引。

## 📁 规则文档目录

### 项目基础
- **[项目概述](docs/rules/project-overview.md)** - 技术栈、框架版本
- **[目录结构](docs/rules/directory-structure.md)** - 完整目录树和职责说明
- **[环境变量](docs/rules/environment-variables.md)** - 配置规范和必需变量
- **[包管理](docs/rules/package-management.md)** - pnpm 使用和常用命令
- **[Git 规范](docs/rules/git-conventions.md)** - Commit 格式和分支策略
- **[代码风格](docs/rules/code-style.md)** - 命名规范、TypeScript 规范、注释规范

### 开发规范
- **[前端开发](docs/rules/frontend.md)** - Next.js App Router、React 19、Ant Design 6.x
- **[Ant Design v6 迁移手册](docs/rules/antd-v6-migration.md)** - v6 组件 API 新旧写法、扫描命令、迁移验收
- **[后端开发](docs/rules/backend.md)** - API 路由、服务层、AI 工具选择
- **[数据库开发](docs/rules/database.md)** - Prisma Schema、迁移、查询优化
- **[权限系统](docs/rules/permission.md)** - 多层权限防护、角色定义、API 权限检查

### 功能模块
- **[向量检索](docs/rules/vector-search.md)** - 文章向量化、语义搜索、Qdrant 集成

### 项目管理
- **[计划管理](docs/rules/plans-management.md)** - 计划文档生命周期、完成后处理流程

> 详细索引请查看：**[开发规范文档](docs/rules/README.md)**

## 📂 设计文档目录

详见：[docs/designs/README.md](docs/designs/README.md)

### 可用设计文档

#### AI 系统
- **[AI 配置组管理](docs/designs/ai/ai-config-profiles.md)** - 多套模型地址、模型和密钥配置组切换
- **[AI Lab / LLM 学习实验台](docs/designs/ai/ai-lab.md)** - Run 观测、RAG 评测、检索实验、Prompt Replay 与 LangSmith 集成设计
- **[语音合成](docs/designs/ai/tts-page.md)** - MiMo TTS 语音合成
- **[AI 图片生成](docs/designs/ai/image-gen.md)** - GPT Image 2 文生图/图文编辑

#### 聊天系统
- **[Agent 聊天系统](docs/designs/chat/rag-chat.md)** - 基于 ReAct Agent 的知识问答机器人，RAG 检索作为工具按需调用，并支持聊天记录持久化

#### 向量检索与向量化
- **[向量化总览](docs/designs/vector/overview.md)** - 向量化系统完整介绍
- **[文本切片](docs/designs/vector/chunking.md)** - Markdown 分块策略
- **[向量存储](docs/designs/vector/storage.md)** - Qdrant 集成和操作
- **[向量化队列](docs/designs/vector/queue.md)** - 异步队列系统
- **[语义搜索](docs/designs/search/semantic-search.md)** - 向量检索实现

#### 业务功能
- **[内容创作中台](docs/designs/features/content-creation-platform.md)** - 独立 `/create` 创作后台，整合博客文章与 `xhs` 本地工作流
- **[博客合集功能设计](docs/designs/features/collection-design.md)** - 文章合集管理功能
- **[评论系统设计](docs/designs/features/comment-system-design.md)** - 评论功能设计
- **[实体变更日志](docs/designs/features/entity-change-design.md)** - 数据变更追踪
- **[统计系统设计](docs/designs/features/analytics-system-design.md)** - 点赞防刷 + GA4

#### 首页与风格
- **[站点级昼夜风格语义系统](docs/designs/homepage/day-night-style-system.md)** - 日间温和文艺、夜间赛博朋克的站点级风格与文案语义系统
- **[首页 3D 昼夜双主题](docs/designs/homepage/homepage-3d-day-night.md)** - 同一 3D 房间的日间文艺、夜间赛博朋克主题，以及文章列表衔接方向
- **[首页 3D 房间布局规范](docs/designs/homepage/cyberpunk-homepage-room-layout.md)** - 三视图原型与家具空间关系基准
- **[赛博朋克风格元素资料库](docs/reference/cyberpunk-style-elements.md)** - 夜间模式、`/chat` 风格和 UI 命名可借用的赛博朋克元素

#### 基础设施
- **[权限系统设计](docs/designs/infra/permission-design.md)** - 多层权限防护架构
- **[配置化 RBAC](docs/designs/infra/rbac-config-design.md)** - 角色权限配置化 + 统一接口注册表 + MCP 自动注册
- **[MCP OAuth 2.0 认证设计](docs/designs/infra/mcp-oauth-design.md)** - MCP 服务 OAuth 2.0 集成
- **[后台任务队列系统](docs/designs/infra/task-queue.md)** - 通用 TaskQueue、业务适配器、图片生成队列监控与重试
- **[性能优化计划](docs/designs/infra/performance-optimization-plan.md)** - 性能优化实施记录

## 📋 计划文档目录

详见：[docs/plans/README.md](docs/plans/README.md)

### 当前计划
- **[模板管理与内容 Agent 建设](docs/plans/content-template-agent.md)** — 🔄 进行中（`content_templates`、模板 CRUD、`xhs/prompts` 导入和 `/create/templates` 管理页已落地；下一步做数据库结构同步和模板驱动草稿生成）
- **[内容创作中台建设](docs/plans/content-creation-platform.md)** — 🔄 进行中（阶段 0-3 部分完成：草稿库、素材库、选题库模型/API/列表页已落地，AI 可从博客文章生成选题；下一步做选题/博客到图文草稿生成）
- **[赛博朋克 3D 首页改造](docs/plans/cyberpunk-homepage-3d.md)** — 🔄 进行中（三视图布局基准已落地，文章列表赛博日志流原型已补充，昼夜双风格已提升为站点级语义系统）
- **[AI Lab / LLM 学习实验台建设](docs/plans/ai-lab-llm-learning.md)** — 🔄 进行中（已完成后台信息架构拆分与 Run 观测表/接口/页面，后续推进 Run 转 Eval Case、Golden Dataset、Prompt Replay 与 LangSmith 集成）
- **[Prisma 7 升级](docs/plans/prisma-7-upgrade.md)** — ✅ 已完成（Prisma 7.8.0、`prisma.config.ts`、MariaDB adapter、生成客户端导入、类型检查、构建与 Dockerfile.prod 验证已落地）

### 已完成计划（已归档到 `docs/designs/archive/`）
- **[LangChain/LangGraph 迁移](docs/designs/archive/chat-langchain-migration.md)** - 聊天系统迁移至 LangGraph
- **[管理后台移动端适配](docs/designs/archive/admin-mobile-ux.md)** - 响应式 Sider/Drawer 切换

## 📖 技术参考目录

详见：`docs/reference/`

### 技术参考文档
- **[路由结构说明](docs/reference/ROUTES.md)** - 路由设计参考
- **[队列调试指南](docs/reference/QUEUE-DEBUG-GUIDE.md)** - 向量化队列调试
- **[Prisma 版本说明](docs/reference/PRISMA_VERSION_NOTE.md)** - Prisma 相关技术说明
- **[MCP 合集使用指南](docs/reference/mcp-collections-guide.md)** - MCP 合集功能使用指南
- **[Chat Agent 系统提示词模板](docs/reference/chat-agent-system-prompt.md)** - Chat Agent 提示词模板，运行时由 LangChain `PromptTemplate` 注入变量

## 🚀 部署

- **CI/CD**: GitHub Actions (`Docker Release` workflow)，push 到 `main` 分支自动触发
- **部署目标**: Docker 镜像构建后部署到 `www.nnnnzs.cn`（非 Vercel）
- **构建命令**: `pnpm build`（含 `npx prisma generate && next build`）
- **注意**: 不是 Vercel 部署，不要使用 `vercel` CLI

## 🚀 快速开始

### 首次使用
1. 阅读 [项目概述](docs/rules/project-overview.md) 了解技术栈
2. 阅读 [目录结构](docs/rules/directory-structure.md) 了解代码组织
3. 配置环境变量（参考 [环境变量](docs/rules/environment-variables.md)）
4. 运行 `pnpm install` 安装依赖
5. 运行 `pnpm dev` 启动开发服务器

### 日常开发
- **前端开发**: 参考 [前端开发规范](docs/rules/frontend.md)
- **后端开发**: 参考 [后端开发规范](docs/rules/backend.md)
- **API 开发**: 参考 [权限系统](docs/rules/permission.md) 确保安全
- **数据库变更**: 参考 [数据库规范](docs/rules/database.md)

### Git 提交
参考 [Git 规范](docs/rules/git-conventions.md)：
```bash
feat(scope): 简短描述
fix(scope): 简短描述
```

### 计划管理
参考 [计划管理规范](docs/rules/plans-management.md)：
- 计划完成后及时清理或移至设计文档
- 保持 `docs/plans/` 目录整洁

## 🔑 核心概念

### 权限系统
项目使用**多层权限防护**，所有 API 必须实现权限验证：
- 前端 UI 控制（仅用户体验）
- 路由守卫
- **API 权限验证**（核心防护）
- 服务层过滤

详见：[权限系统](docs/rules/permission.md)

### 昼夜风格语义系统
项目的日间/夜间不只是样式切换，而是站点级双重风格：
- 日间：温和、明亮、文艺、适合阅读和创作
- 夜间：赛博朋克、霓虹、雨夜、终端、记忆芯片和城市边缘感

新增或修改前台文案、模块名称、空状态、按钮、`/chat` 回答风格时，应优先参考 [站点级昼夜风格语义系统](docs/designs/homepage/day-night-style-system.md)。夜间模式相关命名和视觉母题参考 [赛博朋克风格元素资料库](docs/reference/cyberpunk-style-elements.md)。

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

详见：[前端开发规范](docs/rules/frontend.md)

### AI 工具选择
根据模型提供商选择对应工具：
- **Anthropic Claude**: `@anthropic-ai/sdk`（官方 SDK）
- **OpenAI**: `@langchain/openai`（LangChain 包装）

详见：[后端开发规范](docs/rules/backend.md)

## 📝 文档约定

### 规范文档
- 格式：Markdown (`.md`)
- 位置：`docs/rules/*.md`
- 作用：开发规范指导、AI 辅助编码

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

更多命令：[包管理](docs/rules/package-management.md)

## ⚠️ 重要提示

### 项目结构变更
当涉及目录结构或架构变更时，**必须**同步更新规范文件：
1. 更新受影响的 `docs/rules/*.md` 文件
2. 在 commit message 中注明规范文件更新

详见：[Git 规范](docs/rules/git-conventions.md)

### 计划完成后处理
计划状态变为 **✅ 已完成** 时，**必须**执行清理：
- 有价值的计划 → 移至 `docs/designs/`
- 无价值的计划 → 删除
- 更新 `docs/plans/README.md`

详见：[计划管理](docs/rules/plans-management.md)

### TypeScript 严格模式
项目已启用严格模式：
- 禁止使用 `any`
- 必须明确类型定义
- 使用 `unknown` 代替 `any`

详见：[代码风格](docs/rules/code-style.md)

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
