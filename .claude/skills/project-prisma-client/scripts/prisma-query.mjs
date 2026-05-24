#!/usr/bin/env node
import { PrismaClient } from '../../../../src/generated/prisma-client/index.js';

const WRITE_PATTERNS = [
  /\bcreate(?:Many)?\s*\(/,
  /\bupdate(?:Many)?\s*\(/,
  /\bupsert\s*\(/,
  /\bdelete(?:Many)?\s*\(/,
  /\$executeRaw(?:Unsafe)?\s*\(/,
  /\$queryRawUnsafe\s*\(/,
];

function printUsage() {
  console.error(`Usage:
  node .claude/skills/project-prisma-client/scripts/prisma-query.mjs "prisma.tbPost.findMany({ take: 5 })"
  node .claude/skills/project-prisma-client/scripts/prisma-query.mjs --raw "SELECT COUNT(*) AS count FROM tb_post"

Notes:
  - The first argument is a JavaScript expression.
  - The expression receives: prisma.
  - Only read queries are allowed by this script.
  - Write/delete/migration operations require separate explicit confirmation.`);
}

function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
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

function assertReadOnly(query) {
  for (const pattern of WRITE_PATTERNS) {
    if (pattern.test(query)) {
      throw new Error('Blocked non-read Prisma operation. Show the planned write/delete/migration and ask the user for explicit confirmation first.');
    }
  }
}

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result = {};
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

async function main() {
  const options = parseArgs(process.argv);

  if (options.help || !options.query) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  assertReadOnly(options.query);

  const prisma = new PrismaClient({ log: ['error', 'warn'] });

  try {
    let data;

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
