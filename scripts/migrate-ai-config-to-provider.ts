/**
 * 一次性迁移脚本：把旧 tbConfig 中的 AI profile JSON 迁移到新的 provider + binding 表
 *
 * 用法: pnpm tsx scripts/migrate-ai-config-to-provider.ts
 *
 * 逻辑:
 * 1. 读取 tbConfig 中 ai.profile_groups / ai.active_profiles 两个 JSON key
 * 2. 遍历每个 scenario 的每条 profile，以 base_url 去重 upsert 到 tb_ai_provider
 * 3. 激活 profile → is_active=true 的 binding，其余 → is_active=false
 * 4. 迁移完成后删除旧 3 个 JSON key
 *
 * 幂等设计：provider 按 base_url 去重，可重复执行（但旧 key 只在首次删除）。
 */

import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma-client/client';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL 未配置');
  }
  return url;
}

const adapter = new PrismaMariaDb(getDatabaseUrl());
const prisma = new PrismaClient({ adapter });

function normalizeModels(models: unknown): string[] {
  let raw = models;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      raw = [raw];
    }
  }
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

async function appendProviderModel(providerId: number, model: string): Promise<void> {
  const existing = await prisma.tbAiProvider.findUnique({ where: { id: providerId } });
  if (!existing) return;

  const currentModels = normalizeModels(existing.models);
  if (currentModels.includes(model)) return;

  await prisma.tbAiProvider.update({
    where: { id: providerId },
    data: {
      models: [...currentModels, model],
      updated_at: new Date(),
    },
  });
}

interface LegacyProfile {
  id: string;
  name: string;
  description?: string;
  config: {
    api_key?: string;
    model?: string;
    base_url?: string;
    temperature?: string;
    max_tokens?: string;
    dimensions?: string;
    api_mode?: string;
    voice?: string;
  };
}

async function main() {
  console.log('=== AI 配置迁移: profile_groups → provider + binding ===\n');

  // 1. 读取旧 JSON
  const profileRows = await prisma.tbConfig.findMany({
    where: { key: { in: ['ai.profile_groups', 'ai.active_profiles', 'ai.fallback_profiles'] } },
  });

  const profileGroupRow = profileRows.find((r) => r.key === 'ai.profile_groups');
  const activeRow = profileRows.find((r) => r.key === 'ai.active_profiles');

  if (!profileGroupRow?.value) {
    console.log('未找到 ai.profile_groups，无需迁移。');
    return;
  }

  let profileGroup: unknown;
  try {
    profileGroup = JSON.parse(profileGroupRow.value);
  } catch {
    console.error('ai.profile_groups JSON 解析失败');
    return;
  }

  let activeProfileIds: Record<string, string> = {};
  if (activeRow?.value) {
    try {
      activeProfileIds = JSON.parse(activeRow.value) as Record<string, string>;
    } catch {
      console.warn('ai.active_profiles JSON 解析失败，忽略');
    }
  }

  if (!profileGroup || typeof profileGroup !== 'object' || !('scenarioProfiles' in profileGroup)) {
    console.log('ai.profile_groups 格式不符预期(scenarioProfiles 缺失)，跳过。');
    return;
  }

  const scenarioProfiles = (profileGroup as { scenarioProfiles: Record<string, unknown> }).scenarioProfiles;

  // 2. 遍历 scenario → profile，upsert provider + create binding
  const providerMap = new Map<string, number>(); // base_url → provider.id

  const scenarios = Object.entries(scenarioProfiles);
  let totalProviders = 0;
  let totalBindings = 0;

  for (const [scenario, profilesRaw] of scenarios) {
    const profiles = Array.isArray(profilesRaw)
      ? (profilesRaw as LegacyProfile[])
      : [];

    if (profiles.length === 0) continue;

    const activeId = activeProfileIds[scenario];

    for (const profile of profiles) {
      const baseUrl = profile.config?.base_url?.trim();
      const apiKey = profile.config?.api_key?.trim();
      const model = profile.config?.model?.trim();

      if (!baseUrl || !apiKey) {
        console.log(`  [跳过] scenario=${scenario} profile=${profile.id}: 缺少 base_url 或 api_key`);
        continue;
      }

      // upsert provider
      let providerId = providerMap.get(baseUrl);
      if (!providerId) {
        const existing = await prisma.tbAiProvider.findFirst({ where: { base_url: baseUrl } });
        if (existing) {
          providerId = existing.id;
        } else {
          const created = await prisma.tbAiProvider.create({
            data: {
              name: `${baseUrl.replace(/https?:\/\//, '').split('/')[0]}`,
              base_url: baseUrl,
              api_key: apiKey,
              models: model ? [model] : [],
              status: 1,
              created_at: new Date(),
              updated_at: new Date(),
            },
          });
          providerId = created.id;
          totalProviders++;
        }
        providerMap.set(baseUrl, providerId);
      }

      // 把同 base_url 下出现过的模型都补到 provider.models，Prisma Json 字段直接写数组
      if (providerId && model) {
        await appendProviderModel(providerId, model);
      }

      if (!providerId) continue;

      // create binding
      const isActive = profile.id === activeId;
      try {
        await prisma.tbAiScenarioBinding.create({
          data: {
            scenario,
            provider_id: providerId,
            model: model || 'unknown',
            name: profile.name || null,
            remark: profile.description || null,
            temperature: profile.config?.temperature ? parseFloat(profile.config.temperature) : null,
            max_tokens: profile.config?.max_tokens ? parseInt(profile.config.max_tokens, 10) : null,
            dimensions: profile.config?.dimensions ? parseInt(profile.config.dimensions, 10) : null,
            api_mode: profile.config?.api_mode || null,
            voice: profile.config?.voice || null,
            is_active: isActive,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        totalBindings++;
      } catch (err) {
        console.log(`  [跳过] binding 创建失败: scenario=${scenario} profile=${profile.id}`, err);
      }
    }
  }

  console.log(`\n迁移结果:`);
  console.log(`  供应商: ${totalProviders} (已去重)`);
  console.log(`  绑定:   ${totalBindings}`);
  console.log(`  场景:   ${scenarios.length}`);

  // 3. 删除旧 3 个 key
  const keysToDelete = ['ai.profile_groups', 'ai.active_profiles', 'ai.fallback_profiles'];
  for (const key of keysToDelete) {
    const row = profileRows.find((r) => r.key === key);
    if (row?.id) {
      await prisma.tbConfig.delete({ where: { id: row.id } });
      console.log(`  已删除旧配置 key: ${key}`);
    }
  }

  console.log('\n✅ 迁移完成');
}

main()
  .catch((err) => {
    console.error('迁移失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
