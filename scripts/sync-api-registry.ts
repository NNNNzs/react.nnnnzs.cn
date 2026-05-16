/**
 * API Registry Sync Script
 *
 * Scan route.ts files and sync descriptors to database
 *
 * Usage: pnpm sync:api-registry
 */

import fg from 'fast-glob';
import * as path from 'path';

// PrismaClient
let prisma: any = null;

async function initPrisma() {
  try {
    const { PrismaClient } = await import('../src/generated/prisma-client');
    prisma = new PrismaClient();
    return true;
  } catch (error) {
    console.warn('⚠️ Prisma Client not generated, run pnpm prisma:generate');
    return false;
  }
}

/** Extracted API info */
interface ExtractedApi {
  code: string;
  name: string;
  description?: string;
  module: string;
  method: string;
  permissionCode?: string;
  inputSchema?: Record<string, unknown>;
  cacheTags?: string[];
  apiPath: string;
}

/**
 * Extract descriptors from route.ts file via dynamic import
 */
async function extractDescriptors(filePath: string): Promise<ExtractedApi[]> {
  const results: ExtractedApi[] = [];

  try {
    // Dynamic import the route module
    const module = await import(filePath);
    const apiPath = filePath
      .replace(/.*\/src\/app/, '')
      .replace(/\/route\.ts$/, '');

    // Check for single descriptor export
    if (module.descriptor && module.descriptor.code) {
      results.push({
        ...module.descriptor,
        apiPath,
      });
    }

    // Check for multiple descriptors (xxxDescriptor pattern)
    for (const key of Object.keys(module)) {
      if (key !== 'descriptor' && key.endsWith('Descriptor') && module[key]?.code) {
        results.push({
          ...module[key],
          apiPath,
        });
      }
    }
  } catch (error) {
    // Skip files that can't be imported (missing deps, etc.)
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning API routes...\n');

  const hasPrisma = await initPrisma();

  // Scan all route.ts files
  const files = await fg('src/app/api/**/route.ts', {
    cwd: process.cwd(),
    absolute: true,
  });

  console.log(`📁 Found ${files.length} route.ts files\n`);

  // Extract descriptors via dynamic import
  const extractedApis: ExtractedApi[] = [];

  for (const filePath of files) {
    const descriptors = await extractDescriptors(filePath);
    extractedApis.push(...descriptors);
  }

  console.log(`✅ Extracted ${extractedApis.length} API descriptors:\n`);

  for (const api of extractedApis) {
    console.log(`  ${api.method} ${api.apiPath}`);
    console.log(`    code: ${api.code}`);
    console.log(`    name: ${api.name}`);
    console.log(`    permission: ${api.permissionCode || 'public'}`);
    console.log('');
  }

  // Sync to database
  if (!prisma) {
    console.log('⚠️ Prisma not initialized, skipping database sync');
    return;
  }

  console.log('💾 Syncing to database...\n');

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const api of extractedApis) {
    try {
      const existing = await prisma.tbApiRegistry.findUnique({
        where: { code: api.code },
      });

      const data = {
        code: api.code,
        name: api.name,
        description: api.description || null,
        module: api.module,
        api_path: api.apiPath,
        api_method: api.method,
        permission_code: api.permissionCode || null,
        input_schema: api.inputSchema ? JSON.stringify(api.inputSchema) : null,
        cache_tags: api.cacheTags ? api.cacheTags.join(',') : null,
        mcp_available: 1,
        auto_discovered: 1,
        synced_at: new Date(),
      };

      if (!existing) {
        await prisma.tbApiRegistry.create({ data });
        created++;
        console.log(`  ✅ Created: ${api.code}`);
      } else {
        const hasChanges =
          existing.name !== data.name ||
          existing.description !== data.description ||
          existing.module !== data.module ||
          existing.api_path !== data.api_path ||
          existing.api_method !== data.api_method ||
          existing.permission_code !== data.permission_code;

        if (hasChanges) {
          await prisma.tbApiRegistry.update({
            where: { code: api.code },
            data,
          });
          updated++;
          console.log(`  📝 Updated: ${api.code}`);
        } else {
          await prisma.tbApiRegistry.update({
            where: { code: api.code },
            data: { synced_at: new Date() },
          });
          unchanged++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${api.code}`, error);
    }
  }

  // Disable APIs not found in code scan
  // 保留 mcp_available=1 或 mcp_enabled=1 的接口（它们有 MCP handler，来自 api-registry.ts）
  const codes = extractedApis.map(a => a.code);
  const disabled = await prisma.tbApiRegistry.updateMany({
    where: {
      code: { notIn: codes },
      auto_discovered: 1,
      status: 1,
      mcp_available: 0,
      mcp_enabled: 0,
    },
    data: { status: 0 },
  });

  console.log('\n📊 Sync complete:');
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Disabled: ${disabled.count}`);

  // 标记有 MCP handler 的接口（这些 code 在 api-registry.ts 的 API_REGISTRY 中有 handler）
  // 新增 MCP handler 时需要同步更新此列表
  const handlerCodes = [
    'post_create', 'post_update', 'post_delete', 'post_get', 'post_list',
  ];

  console.log('🔧 Syncing MCP handler status...');

  // 有 handler 的启用 mcp_available，并恢复之前被禁用的 mcp_enabled
  const r1 = await prisma.tbApiRegistry.updateMany({
    where: { code: { in: handlerCodes } },
    data: { mcp_available: 1, mcp_enabled: 1 },
  });

  // 没有代码 entry 的禁用 mcp_available 并关闭 MCP
  const mcpUnavailable = await prisma.tbApiRegistry.updateMany({
    where: { code: { notIn: handlerCodes } },
    data: { mcp_available: 0, mcp_enabled: 0 },
  });
  console.log(`  [2/2] Done, affected: ${mcpUnavailable.count}`);
  if (mcpUnavailable.count > 0) {
    console.log(`  MCP Unavailable (no handler): ${mcpUnavailable.count}`);
  }

  console.log('🔌 Disconnecting...');
  await prisma.$disconnect();
  console.log('👋 Done.');

  // 强制退出，避免其他模块（如 Redis）的连接导致进程挂起
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
