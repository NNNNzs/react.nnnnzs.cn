---
name: project-prisma-client
description: "Use this skill whenever the user asks to query, inspect, count, update, insert, delete, or otherwise operate on this project's database through Prisma. It is specifically for this Node.js repo's generated Prisma Client at src/generated/prisma-client and the bundled .claude/skills/project-prisma-client/scripts/prisma-query.mjs helper. Trigger for requests mentioning Prisma, database rows, MySQL data, articles/users/config records, admin data checks, or DB mutations. Read operations may run through the helper directly; write/delete/migration operations require showing the planned operation and getting explicit user confirmation first."
---

You help operate this project's database through a reusable Node.js helper that loads the generated Prisma Client.

## Project context

- Repository: `D:/project/react.nnnnzs.cn`
- Prisma schema: `prisma/schema.prisma`
- Generated client output: `src/generated/prisma-client`
- Query helper: `.claude/skills/project-prisma-client/scripts/prisma-query.mjs`
- Runtime: Node.js ESM
- Package manager: `pnpm`
- Database provider: MySQL via `DATABASE_URL`

## Default workflow

For read-only database queries, use the bundled Node.js helper instead of creating temporary scripts:

```bash
node .claude/skills/project-prisma-client/scripts/prisma-query.mjs "prisma.tbPost.findMany({ where: { is_delete: 0, hide: '0' }, select: { id: true, title: true, path: true, updated: true }, orderBy: { updated: 'desc' }, take: 5 })"
```

For read-only SQL that Prisma Client cannot express cleanly:

```bash
node .claude/skills/project-prisma-client/scripts/prisma-query.mjs --raw "SELECT COUNT(*) AS count FROM tb_post"
```

The helper accepts a JavaScript expression with `prisma` in scope, prints sanitized JSON, and disconnects automatically.

## Safety model

Read-only operations can run after briefly stating what will be queried.

Before any write operation, deletion, raw SQL mutation, schema push, or migration:

1. Show the exact intended operation in Chinese.
2. Explain affected model/table, filter conditions, and fields to change.
3. Ask for explicit confirmation.
4. Do not execute until the user confirms.

Treat these as write operations: `create`, `createMany`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`, `$executeRaw`, `$executeRawUnsafe`, `pnpm prisma:migrate`, `pnpm prisma:push`, and manual SQL that changes data or schema.

The helper blocks common Prisma write methods, but do not rely on that as the only safeguard. If the user asks for mutation, stop and confirm first.

Avoid exposing secrets. Do not print `DATABASE_URL`, passwords, tokens, GitHub access tokens, long-term tokens, or full sensitive values. Mask sensitive fields if they appear in results.

## Result format

Reply in Chinese and include:

1. A concise summary of what was queried or changed.
2. A markdown table for small tabular results.
3. JSON only when the user asks for raw data or when nested data is easier to understand as JSON.
4. A note about row counts and any filters used.

For large result sets, limit output and mention the limit. Default to `take: 20` for list queries unless the user specifies otherwise.

## Common examples

Recent visible posts:

```bash
node .claude/skills/project-prisma-client/scripts/prisma-query.mjs "prisma.tbPost.findMany({ where: { is_delete: 0, hide: '0' }, select: { id: true, title: true, path: true, updated: true }, orderBy: { updated: 'desc' }, take: 5 })"
```

Count core models:

```bash
node .claude/skills/project-prisma-client/scripts/prisma-query.mjs "Promise.all([prisma.tbPost.count(), prisma.tbUser.count(), prisma.tbCollection.count()]).then(([posts, users, collections]) => ({ posts, users, collections }))"
```

Find config keys without exposing values:

```bash
node .claude/skills/project-prisma-client/scripts/prisma-query.mjs "prisma.tbConfig.findMany({ select: { id: true, title: true, key: true, status: true, updated_at: true }, orderBy: { id: 'asc' }, take: 50 })"
```

## Common model names

Use `prisma/schema.prisma` as authority, but these models commonly exist:

- `tbPost` / table `tb_post`: articles/posts.
- `tbUser` / table `tb_user`: users.
- `tbConfig` / table `tb_config`: site configuration.
- `tbCollection` / table `tb_collection`: article collections.
- `tbComment` / table `tb_comment`: comments.
- `tbRole`, `tbPermission`, `tbUserRole`, `tbRolePermission`: RBAC.
- `tbApiRegistry`: API registry.
- `tbImageGenLog`: image generation logs.

## Good defaults

- Filter soft-deleted content with `is_delete: 0` when the model has that field.
- Filter visible posts with `hide: '0'` when the user asks for public/visible content.
- Select only needed fields; avoid selecting password/token fields.
- For counts, use `count()` or `groupBy()` instead of fetching all rows.
- For raw SQL, prefer Prisma query methods first. Use `--raw` only for read-only SQL.

## When blocked

If the generated client is missing or stale, run `pnpm prisma:generate` before querying.
If environment variables are missing, tell the user which variable is required without printing secret values.
If a query fails because the model/field name changed, re-read `prisma/schema.prisma` and adjust.
