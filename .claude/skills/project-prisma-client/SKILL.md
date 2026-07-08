---
name: project-prisma-client
description: "Use this skill whenever the user needs to query, inspect, count, or safely mutate this repository's database through Prisma. It should trigger for requests about Prisma data in this repo — articles, users, configs, collections, comments, RBAC, API registry, image logs, row counts, filters, or read-only SQL — especially when the user wants results from the generated Prisma Client in src/generated/prisma-client. Read queries run through the bundled Node.js helper; any create, update, delete, raw mutation, or migration must be proposed first and executed only after explicit confirmation."
---

Use this skill to work with this project's database through the generated Prisma Client.

## Use the bundled helper

For read-only queries, use the Node.js helper instead of writing temporary scripts:

```bash
npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbUser.count()"
```

For read-only SQL that Prisma Client cannot express cleanly:

```bash
npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts --raw "SELECT COUNT(*) AS count FROM tb_user"
```

The helper accepts a JavaScript expression with `prisma` in scope, prints sanitized JSON, and disconnects automatically.

## Safety rules

- Read-only queries can run after a brief说明 of what will be queried.
- Write/delete/migration requests require a clear plan in Chinese and explicit confirmation before execution.
- Treat these as write operations: `create`, `createMany`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`, `$executeRaw`, `$executeRawUnsafe`, `pnpm prisma:migrate`, `pnpm prisma:push`.
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
npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbPost.findMany({ where: { is_delete: 0, hide: '0' }, select: { id: true, title: true, path: true, updated: true }, orderBy: { updated: 'desc' }, take: 5 })"
```

Core counts:

```bash
npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts "Promise.all([prisma.tbPost.count(), prisma.tbUser.count(), prisma.tbCollection.count()]).then(([posts, users, collections]) => ({ posts, users, collections }))"
```

## Model names

Common models in this repo include `tbPost`, `tbUser`, `tbConfig`, `tbCollection`, `tbComment`, `tbRole`, `tbPermission`, `tbUserRole`, `tbRolePermission`, `tbApiRegistry`, and `tbImageGenLog`.

## When blocked

If the generated client is missing or stale, run `pnpm prisma:generate` before querying.
If a query fails because the model or field name changed, re-read `prisma/schema.prisma` and adjust.
