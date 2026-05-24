# Project Prisma Client Skill Notes

## Repo-specific facts

- Prisma schema: `prisma/schema.prisma`
- Generated Prisma Client: `src/generated/prisma-client`
- App singleton helper: `src/lib/prisma.ts`
- Prisma generator output is customized, so do not import from `@prisma/client` for project DB scripts.
- Use `pnpm exec tsx scripts/<name>.ts` for TypeScript database scripts.

## Sensitive fields to avoid printing

- `password`
- `github_access_token`
- `token`
- fields containing `secret`, `key`, `access_token`, or `password`
- `DATABASE_URL`
