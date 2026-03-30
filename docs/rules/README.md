# 开发规范文档

本目录包含项目开发规范文档，涵盖前端、后端、数据库、代码风格等各个方面。

## 📁 规范文档目录

### 项目基础
- **[项目概述](project-overview.md)** - 技术栈、框架版本
- **[目录结构](directory-structure.md)** - 完整目录树和职责说明
- **[环境变量](environment-variables.md)** - 配置规范和必需变量
- **[包管理](package-management.md)** - pnpm 使用和常用命令
- **[Git 规范](git-conventions.md)** - Commit 格式和分支策略
- **[代码风格](code-style.md)** - 命名规范、TypeScript 规范、注释规范

### 开发规范
- **[前端开发](frontend.md)** - Next.js App Router、React 19、Ant Design 6.x
- **[后端开发](backend.md)** - API 路由、服务层、AI 工具选择
- **[数据库开发](database.md)** - Prisma Schema、迁移、查询优化
- **[权限系统](permission.md)** - 多层权限防护、角色定义、API 权限检查

### 功能模块
- **[向量检索](vector-search.md)** - 文章向量化、语义搜索、Qdrant 集成

### 项目管理
- **[计划管理](plans-management.md)** - 计划文档生命周期、完成后处理流程

## 🚀 快速开始

### 首次使用
1. 阅读 [项目概述](project-overview.md) 了解技术栈
2. 阅读 [目录结构](directory-structure.md) 了解代码组织
3. 配置环境变量（参考 [环境变量](environment-variables.md)）
4. 运行 `pnpm install` 安装依赖
5. 运行 `pnpm dev` 启动开发服务器

### 日常开发
- **前端开发**: 参考 [前端开发规范](frontend.md)
- **后端开发**: 参考 [后端开发规范](backend.md)
- **API 开发**: 参考 [权限系统](permission.md) 确保安全
- **数据库变更**: 参考 [数据库规范](database.md)

### Git 提交
参考 [Git 规范](git-conventions.md)：
```bash
feat(scope): 简短描述
fix(scope): 简短描述
```

### 计划管理
参考 [计划管理规范](plans-management.md)：
- 计划完成后及时清理或移至设计文档
- 保持 `docs/plans/` 目录整洁

## 🔑 核心概念

### 权限系统
项目使用**多层权限防护**，所有 API 必须实现权限验证：
- 前端 UI 控制（仅用户体验）
- 路由守卫
- **API 权限验证**（核心防护）
- 服务层过滤

详见：[权限系统](permission.md)

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

详见：[前端开发规范](frontend.md)

### AI 工具选择
根据模型提供商选择对应工具：
- **Anthropic Claude**: `@anthropic-ai/sdk`（官方 SDK）
- **OpenAI**: `@langchain/openai`（LangChain 包装）

详见：[后端开发规范](backend.md)

## 📝 文档约定

### 规范文件
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

更多命令：[包管理](package-management.md)

## ⚠️ 重要提示

### 项目结构变更
当涉及目录结构或架构变更时，**必须**同步更新规范文件：
1. 更新受影响的 `docs/rules/*.md` 文件
2. 在 commit message 中注明规范文件更新

详见：[Git 规范](git-conventions.md)

### 计划完成后处理
计划状态变为 **✅ 已完成** 时，**必须**执行清理：
- 有价值的计划 → 移至 `docs/designs/`
- 无价值的计划 → 删除
- 更新 `docs/plans/README.md`

详见：[计划管理](plans-management.md)

### TypeScript 严格模式
项目已启用严格模式：
- 禁止使用 `any`
- 必须明确类型定义
- 使用 `unknown` 代替 `any`

详见：[代码风格](code-style.md)

## 🔗 相关资源

### 官方文档
- [Next.js 16](https://nextjs.org/docs)
- [React 19](https://react.dev)
- [Prisma](https://www.prisma.io/docs)
- [Ant Design 6.x](https://ant.design/components)
- [Vercel React Best Practices](https://github.com/vercel/next.js/tree/canary/packages/react-best-practices)

### 项目文档
- [设计文档](../designs/README.md) - 功能设计文档
- [技术参考](../reference/) - 技术文档索引
- [开发计划](../plans/README.md) - 开发计划

