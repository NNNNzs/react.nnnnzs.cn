#!/usr/bin/env tsx

/**
 * Prisma 7.x Query Helper for Claude Code Skills
 * Usage:
 *   npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbPost.findMany({ take: 5 })"
 *   npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts --raw "SELECT COUNT(*) AS count FROM tb_post"
 */

import { config } from 'dotenv';
import { readdirSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../../src/generated/prisma-client/client';

// 加载项目根目录的 .env 文件
config({ path: resolve(process.cwd(), '.env') });

function printUsage(): void {
  console.error(`Usage:
  npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts "prisma.tbPost.findMany({ take: 5 })"
  npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts --raw "SELECT COUNT(*) AS count FROM tb_post"
  npx tsx .claude/skills/project-prisma-client/scripts/prisma-query.ts --models

Notes:
  - The first argument is a JavaScript expression.
  - The expression receives: prisma.
  - --models lists all Prisma models grouped by schema file.
  - Write/delete operations execute directly; the calling agent must obtain user confirmation beforehand.`);
}

interface ParseResult {
  help?: boolean;
  models?: boolean;
  raw: boolean;
  query: string;
}

function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { help: true, raw: false, query: '' };
  }

  if (args.includes('--models')) {
    return { models: true, raw: false, query: '' };
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

function listModels(): Record<string, string[]> {
  const schemaDir = resolve(process.cwd(), 'prisma/schema');
  const files = readdirSync(schemaDir).filter((f) => f.endsWith('.prisma'));
  const result: Record<string, string[]> = {};

  for (const file of files) {
    const content = readFileSync(join(schemaDir, file), 'utf-8');
    const matches = content.match(/^model\s+(\w+)/gm);
    if (matches) {
      result[file] = matches.map((m) => m.replace(/^model\s+/, ''));
    }
  }

  return result;
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

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (options.models) {
    console.log(JSON.stringify(listModels(), null, 2));
    return;
  }

  if (!options.query) {
    printUsage();
    process.exit(1);
  }

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
