---
name: project-prisma-client
description: "Use this skill whenever the user needs to query, inspect, count, or safely mutate this repository's database through Prisma. It should trigger for requests about Prisma data in this repo — articles, users, configs, collections, comments, RBAC, API registry, image logs, row counts, filters, or read-only SQL — especially when the user wants results from the generated Prisma Client in src/generated/prisma-client. Read queries run through the bundled Node.js helper. For this project on Mac development, use Prisma db push for schema synchronization within an authorized implementation; distinguish development changes from production or destructive data operations."
---

Use this skill to work with this project's database through the generated Prisma Client.

## Use the bundled helper

For read-only queries, use the Node.js helper instead of writing temporary scripts:

```bash
pnpm exec tsx .agents/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbUser.count()"
```

For read-only SQL that Prisma Client cannot express cleanly:

```bash
pnpm exec tsx .agents/skills/project-prisma-client/scripts/prisma-query.ts --raw "SELECT COUNT(*) AS count FROM tb_user"
```

The helper accepts a JavaScript expression with `prisma` in scope, prints sanitized JSON, and disconnects automatically.

## Environment and project scope

- 本技能只适用于 `react.nnnnzs.cn` 项目；[mac] `/Users/nnnnzs/project/react.nnnnzs.cn` 是 Mac 开发工作区。
- Mac 是开发环境。数据库托管在云端或使用 RDS 域名，不等于正在操作生产环境；结合当前项目配置和用户说明识别环境。
- 数据库结构以 `prisma/schema/*.prisma` 为准，遵循 `docs/rules/database.md`，使用 `pnpm prisma:push` 同步，再运行 `pnpm prisma:generate`。
- 不生成手写建表 SQL，不套用其他项目的 SQL 发布目录、按日迁移或常规 `prisma migrate dev` 流程。

## Authorization and safety

- 用户已授权实现功能时，Mac 开发环境中该功能必需的新增模型、Prisma 结构同步和最小配置/权限初始化属于实施范围。说明影响并审查差异后直接执行，不重复要求逐条 Prisma 表达式确认。
- `db push` 前先查看 schema diff；预期新增表可直接同步。出现删表、删字段、数据丢失或范围外结构变更时停下核对，不使用 `--accept-data-loss`、`--force-reset` 或重置数据库来绕过。
- 生产部署、生产库变更、批量删除/重置业务数据以及超出已授权功能的写入，仍需明确其目标环境和操作范围，并取得相应授权。
- 配置与权限初始化只补齐本功能，保留现有用户、文章及无关角色权限；不因一个功能运行全量重置 seed。
- Read-only queries can run after a brief说明 of what will be queried.
- Do not print `DATABASE_URL`, passwords, tokens, or other secrets.

## Output style

- Reply in Chinese.
- Give a short summary first.
- Use a table for small result sets.
- Use JSON only when the user wants raw data or nested data is clearer as JSON.
- Mention row counts and filters when relevant.

## Good defaults

- Filter soft-deleted rows with `is_delete: 0` when that field exists.
- Filter visible posts with `hide: '0'` when the user asks for public content.
- Select only needed fields.
- Use `count()` for totals.

## Common examples

Recent visible posts:

```bash
pnpm exec tsx .agents/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbPost.findMany({ where: { is_delete: 0, hide: '0' }, select: { id: true, title: true, path: true, updated: true }, orderBy: { updated: 'desc' }, take: 5 })"
```

Core counts:

```bash
pnpm exec tsx .agents/skills/project-prisma-client/scripts/prisma-query.ts "Promise.all([prisma.tbPost.count(), prisma.tbUser.count(), prisma.tbCollection.count()]).then(([posts, users, collections]) => ({ posts, users, collections }))"
```

## Model discovery

List all models grouped by schema file:

```bash
pnpm exec tsx .agents/skills/project-prisma-client/scripts/prisma-query.ts --models
```

This reads `prisma/schema/*.prisma` directly and always reflects the current schema — no hardcoded list to maintain.

## When blocked

If the generated client is missing or stale, run `pnpm prisma:generate` before querying.
If a query fails because the model or field name changed, run `--models` to see current model names, or re-read `prisma/schema/*.prisma` and adjust.
