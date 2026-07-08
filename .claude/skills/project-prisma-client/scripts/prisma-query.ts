#!/usr/bin/env tsx

/**
 * Prisma 7.x Query Helper for Claude Code Skills
 * Usage:
 *   npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbPost.findMany({ take: 5 })"
 *   npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts --raw "SELECT COUNT(*) AS count FROM tb_post"
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../../src/generated/prisma-client/client';

// 加载项目根目录的 .env 文件
config({ path: resolve(process.cwd(), '.env') });

const WRITE_PATTERNS = [
  /\bcreate(?:Many)?\s*\(/,
  /\bupdate(?:Many)?\s*\(/,
  /\bupsert\s*\(/,
  /\bdelete(?:Many)?\s*\(/,
  /\$executeRaw(?:Unsafe)?\s*\(/,
  /\$queryRawUnsafe\s*\(/,
];

function printUsage(): void {
  console.error(`Usage:
  npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbPost.findMany({ take: 5 })"
  npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts --raw "SELECT COUNT(*) AS count FROM tb_post"

Notes:
  - The first argument is a JavaScript expression.
  - The expression receives: prisma.
  - Only read queries are allowed by this script.
  - Write/delete/migration operations require separate explicit confirmation.`);
}

interface ParseResult {
  help?: boolean;
  raw: boolean;
  query: string;
}

function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { help: true, raw: false, query: '' };
  }

  const rawIndex = args.indexOf('--raw');
  if (rawIndex >= 0) {
    return {
      raw: true,
      query: args.slice(rawIndex + 1).join(' ').trim(),
    };
  }

  return {
    raw: false,
    query: args.join(' ').trim(),
  };
}

function assertReadOnly(query: string): void {
  for (const pattern of WRITE_PATTERNS) {
    if (pattern.test(query)) {
      throw new Error('Blocked non-read Prisma operation. Show the planned write/delete/migration and ask the user for explicit confirmation first.');
    }
  }
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('access_key') ||
      lowerKey.includes('accesskey')
    ) {
      result[key] = '[MASKED]';
    } else {
      result[key] = sanitize(entry);
    }
  }
  return result;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL 未配置，无法初始化 Prisma Client');
  }
  return url;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  if (options.help || !options.query) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  assertReadOnly(options.query);

  // 使用项目相同的 adapter 初始化方式
  const adapter = new PrismaMariaDb(getDatabaseUrl());
  const prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });

  try {
    let data: unknown;

    if (options.raw) {
      data = await prisma.$queryRawUnsafe(options.query);
    } else {
      const run = new Function('prisma', `return (${options.query});`);
      data = await run(prisma);
    }

    console.log(JSON.stringify(sanitize(data), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
