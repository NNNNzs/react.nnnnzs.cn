# Prisma 7 升级计划

> **状态**：✅ 已完成
> **创建时间**：2026-07-04
> **最近更新**：2026-07-04
> **参考文章**：博客文章 `id=216`《记一次 Prisma 6 升级 7 的评估与升级指南》

---

## 一、问题分析

当前项目仍使用 Prisma `6.2.1`，生成客户端配置为 `prisma-client-js`，并在 `prisma/schema.prisma` 中配置了 Alpine 部署需要的 `binaryTargets`。

Prisma 7 的主要变化包括：

- 新生成器从 `prisma-client-js` 迁移到 `prisma-client`。
- 生成客户端必须显式配置 `output`。
- Rust 查询引擎被移除，不再需要 `binaryTargets`。
- Prisma CLI 的数据库连接配置迁移到项目根目录的 `prisma.config.ts`。
- `PrismaClient` 实例化必须显式传入数据库 driver adapter。
- 生成客户端导入路径从生成目录根入口迁移到 `client` 子入口。

本项目当前满足的前置条件：

- `package.json` 已配置 `"type": "module"`。
- Node 运行环境为 Node 22。
- TypeScript 使用 `moduleResolution: "bundler"`。
- 未发现 `$use`、`$queryRaw`、`$executeRaw`、`$metrics`、`datasourceUrl`、`datasources` 等需额外迁移的用法。

需要修正博客文章中的一点：Prisma 当前官方 MySQL 快速开始文档使用 `@prisma/adapter-mariadb` / `PrismaMariaDb` 连接 MySQL / MariaDB，而不是 `@prisma/adapter-mysql`。

## 二、影响范围

### 核心配置

- `package.json`
- `pnpm-lock.yaml`
- `prisma/schema.prisma`
- `prisma.config.ts`
- `src/lib/prisma.ts`
- `src/instrumentation.ts`
- `src/instrumentation.node.ts`

### 生成客户端引用

需要迁移 `@/generated/prisma-client`、`../src/generated/prisma-client`、`index.js` 等旧入口引用。

已识别的代码区域：

- `src/services/*`
- `src/dto/*`
- `src/types/index.ts`
- `src/app/c/config/page.tsx`
- `src/app/api/post/create/route.ts`
- `src/app/api/post/[id]/route.ts`
- `prisma/seed-rbac.ts`
- `prisma/migrate-user-roles.ts`
- `scripts/db/*.ts`
- `scripts/debug/test-mcp-client.mjs`

### Docker 构建

生产构建使用 Node 22 Alpine，并在构建阶段执行 `pnpm prisma generate` 与 `pnpm build`。升级后应先验证现有 Alpine 镜像是否能安装并运行 adapter 依赖，如实际构建失败，再补充 `python3 make g++` 等构建依赖。

## 三、目标

1. 将 Prisma CLI 和 Client 从 `6.2.1` 升级到同一 Prisma 7 小版本。
2. 保持现有生成客户端输出目录 `src/generated/prisma-client` 不变，降低业务代码迁移范围。
3. 使用 Prisma 7 官方 MySQL / MariaDB adapter 实例化 `PrismaClient`。
4. 保持现有 `src/lib/prisma.ts` 单例模式和日志配置语义不变。
5. 不调整数据库 schema 语义，不做业务表结构变更。
6. 跑通生成、类型检查、lint 和构建。

## 四、实施步骤

### 阶段 1：分支和依赖

1. [x] 从 `main` 创建升级分支。
2. [x] 升级 `@prisma/client` 和 `prisma` 到 Prisma 7。
3. [x] 新增 `@prisma/adapter-mariadb`。
4. [x] 如 Prisma CLI 需要显式加载 `.env`，确认 `dotenv` 依赖存在。

### 阶段 2：Prisma 配置迁移

1. [x] 将 `generator client.provider` 改为 `prisma-client`。
2. [x] 删除 `binaryTargets`。
3. [x] 从 `datasource db` 移除 `url`。
4. [x] 新增项目根目录 `prisma.config.ts`，配置 `schema`、`migrations.path` 和 `datasource.url`。
5. [x] 执行 `pnpm prisma:generate`，确认新客户端生成结构。

### 阶段 3：运行时代码迁移

1. [x] 将 `src/lib/prisma.ts` 改为 `PrismaMariaDb` adapter 初始化。
2. [x] 保留开发环境全局单例，避免热更新创建多个连接池。
3. [x] 批量迁移所有生成客户端 import 到 `@/generated/prisma-client/client`。
4. [x] 迁移 Prisma 脚本入口中的相对路径 import。
5. [x] 确认 `.mjs` 脚本在生成后的 JS 入口下仍可执行。
6. [x] 将 instrumentation 中依赖 Prisma 的启动恢复逻辑拆到 node-only 模块，避免 Edge instrumentation 编译追踪 Prisma Client。

### 阶段 4：构建与验证

1. [x] `pnpm prisma:generate`
2. [x] `pnpm typecheck`
3. [x] `pnpm lint`
4. [x] `pnpm build`
5. [x] 如需要，执行不启动服务的 Node/Prisma smoke 脚本验证数据库连通性。
6. [x] 如需要，执行 Docker 构建验证。

## 五、验证清单

- [x] Prisma Client 能正常生成。
- [x] TypeScript 类型检查通过。
- [x] ESLint 检查通过。
- [x] Next.js 构建通过。
- [x] `src/lib/prisma.ts` 同款 adapter 初始化能正常查询测试服数据库。
- [x] 后台配置、文章、评论、合集、权限、AI Lab、图片生成日志等 Prisma 高频链路类型无报错。
- [x] 当前发布工作流使用的 `Dockerfile.prod` 不因 adapter 依赖失败。

## 六、执行记录

- 分支：`codex/upgrade-prisma-7`
- Prisma 版本：`prisma` / `@prisma/client` 升级到 `7.8.0`
- 新增依赖：`@prisma/adapter-mariadb`、`dotenv`
- Prisma 配置：新增 `prisma.config.ts`，`schema.prisma` 改用 `prisma-client` 生成器并移除 datasource `url` / `binaryTargets`
- 运行时入口：`src/lib/prisma.ts` 使用 `PrismaMariaDb` adapter，并保留开发环境全局单例
- 脚本入口：新增 `scripts/prisma-client.ts`，供 seed、迁移、调试脚本复用相同 adapter 初始化方式
- pnpm 构建脚本审批：新增 `pnpm-workspace.yaml`，记录已批准的依赖构建脚本
- Instrumentation：`src/instrumentation.ts` 仅做 `NEXT_RUNTIME` 分流，Prisma 和图片生成队列恢复逻辑迁移到 `src/instrumentation.node.ts`
- 验证命令：`pnpm prisma:generate`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 全部通过
- 数据库 smoke：Node/Prisma 直连测试服成功，返回 `{"postCount":204,"configCount":42}`
- Docker 验证：`docker build --platform linux/amd64 -f Dockerfile.prod --target builder ...` 通过
- Docker 验证：`docker build --platform linux/amd64 -f Dockerfile.prod ...` 通过，镜像 `react-nnnnzs-cn:prisma7-full`
- 本地 dev 验证：`pnpm dev` 后访问 `/api/deploy/status` 与首页，不再出现 Prisma Client 的 Edge Runtime warning
- 浏览器验证：首页 `http://localhost:3000/` 正常渲染，标题为 `NNNNzs`

### 非阻塞提示

- `pnpm build` 和 Docker 构建中存在 `baseline-browser-mapping` 数据较旧提示，不影响构建结果。
- Next.js/Turbopack 曾提示 generated Prisma Client 通过 `src/instrumentation.ts` 触达 Edge Runtime；已通过拆分 `src/instrumentation.node.ts` 修复。后续如新增 Edge Runtime 路由，仍需避免直接引用 Prisma。
- `Dockerfile` 使用 `host.docker.internal:4873` 本地 pnpm 镜像源，当前发布工作流实际使用 `.github/workflows/docker-release.yml` 中的 `Dockerfile.prod`。
- Docker runner 阶段额外安装 `tencentcloud-sdk-nodejs` 时，npm audit 提示 2 个中危问题，属于既有镜像补装链路提示，本次 Prisma 升级未处理。

## 七、风险与处理

| 风险 | 影响 | 处理 |
|------|------|------|
| Driver adapter API 与博客文章不同 | `PrismaClient` 初始化失败 | 按官方当前 MySQL 文档使用 `@prisma/adapter-mariadb` |
| 生成客户端导入路径变化 | 大量 TS 编译错误 | 统一迁移到 `client` 子入口，并以 `pnpm typecheck` 收敛 |
| Alpine 环境缺少 native 编译依赖 | Docker 构建失败 | 先验证，失败后只在 deps/builder 阶段补构建依赖 |
| Prisma 7 连接池默认行为变化 | 测试服连接数或超时表现变化 | 先保持 adapter 默认值，若出现连接问题再显式配置连接池 |
| 脚本直接 new PrismaClient | seed / migration / MCP 测试脚本失败 | 统一复用 adapter 初始化模式或改用 `src/lib/prisma` |

## 八、回滚方案

1. 回退升级分支或 revert 升级提交。
2. 恢复 `prisma`、`@prisma/client` 到 `6.2.1`。
3. 恢复 `schema.prisma` 的 `prisma-client-js`、`binaryTargets` 和 datasource `url`。
4. 删除 `prisma.config.ts`。
5. 恢复生成客户端 import 旧入口。
