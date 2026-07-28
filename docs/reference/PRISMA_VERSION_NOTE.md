# Prisma 版本与项目配置

## 当前版本

- `prisma`: 7.8.0
- `@prisma/client`: 7.8.0
- `@prisma/adapter-mariadb`: 7.8.0
- 包管理器：pnpm 10.28.2

三个 Prisma 包必须保持同一精确版本。版本事实以 `package.json` 和 `pnpm-lock.yaml` 为准。

## Schema 布局

项目使用 Prisma 7 的 multi-file schema：

```text
prisma/schema/
├── base.prisma     # generator 与 datasource
├── blog.prisma     # 博客、评论、通知、统计
├── rbac.prisma     # 用户、Token、RBAC、API 注册表
├── ai.prisma       # AI 配置、任务、聊天、AI Lab
└── content.prisma  # 内容创作中台
```

`prisma.config.ts` 指向 `prisma/schema`，并从 `DATABASE_URL` 提供 datasource URL；`base.prisma` 只声明 MySQL provider。生成客户端输出到 `src/generated/prisma-client`。

## 运行时连接

`src/lib/prisma.ts` 使用 `@prisma/adapter-mariadb` 创建 Prisma Client。业务代码应复用该模块，不要自行创建连接池或从旧的 `@prisma/client` 默认输出导入客户端。

## 常用命令

```bash
pnpm prisma:generate
pnpm prisma:push
pnpm prisma:studio
npx prisma validate
npx prisma format
npx prisma --version
```

项目使用 `prisma db push` 同步 schema，不维护 migration 历史。修改 schema 后应依次运行：

```bash
pnpm prisma:push
pnpm prisma:generate
pnpm typecheck
```

生产数据库执行 `db push` 前必须先备份并审查 destructive change 提示。

## Prisma 7 注意事项

- datasource URL 位于 `prisma.config.ts`，不要写回 `base.prisma`。
- generator 使用 `prisma-client`，输出路径是 `src/generated/prisma-client`。
- 构建命令会先执行 `npx prisma generate`。
- 若开发服务器仍持有旧 delegate，重新生成客户端并重启 `pnpm dev`。

最后更新：2026-07-28。
