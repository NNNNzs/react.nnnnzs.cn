import { getPrisma } from '@/lib/prisma';
import {
  AI_ACTIVE_PROFILE_KEY,
  AI_CONFIG_SCENARIOS,
  AI_FALLBACK_PROFILE_KEY,
  AI_PROFILE_STORE_KEY,
  normalizeAIProfileState,
  parseAIProfilePointerMap,
  parseAIProfileStore,
  serializeAIProfilePointerMap,
  serializeAIProfileStore,
  type AIConfigProfile,
  type AIProfileScenarioConfig,
  type AIProfileState,
} from '@/lib/ai-config-profiles';
import type { AIConfigScenario } from '@/lib/ai-config';
import { configByKeys } from '@/services/config';

const LEGACY_FIELD_KEYS: Record<AIConfigScenario, Partial<Record<keyof AIProfileScenarioConfig, string>>> = {
  chat: {
    api_key: 'chat.api_key',
    model: 'chat.model',
    base_url: 'chat.base_url',
    temperature: 'chat.temperature',
    max_tokens: 'chat.max_tokens',
  },
  ai_text: {
    api_key: 'ai_text.api_key',
    model: 'ai_text.model',
    base_url: 'ai_text.base_url',
    temperature: 'ai_text.temperature',
    max_tokens: 'ai_text.max_tokens',
  },
  description: {
    api_key: 'description.api_key',
    model: 'description.model',
    base_url: 'description.base_url',
    temperature: 'description.temperature',
    max_tokens: 'description.max_tokens',
  },
  embedding: {
    api_key: 'embedding.api_key',
    model: 'embedding.model',
    base_url: 'embedding.base_url',
    dimensions: 'embedding.dimensions',
  },
  image_gen: {
    api_key: 'image_gen.api_key',
    model: 'image_gen.model',
    base_url: 'image_gen.base_url',
    api_mode: 'image_gen.api_mode',
  },
  tts: {
    api_key: 'tts.api_key',
    model: 'tts.default_model',
    base_url: 'tts.base_url',
    voice: 'tts.default_voice',
  },
};

export async function getAIProfileState(): Promise<AIProfileState> {
  const configs = await configByKeys([
    AI_PROFILE_STORE_KEY,
    AI_ACTIVE_PROFILE_KEY,
    AI_FALLBACK_PROFILE_KEY,
  ]);
  const store = parseAIProfileStore(configs[AI_PROFILE_STORE_KEY]?.value);
  const activeProfileIds = parseAIProfilePointerMap(configs[AI_ACTIVE_PROFILE_KEY]?.value);
  const fallbackProfileIds = parseAIProfilePointerMap(configs[AI_FALLBACK_PROFILE_KEY]?.value);

  return normalizeAIProfileState({
    scenarioProfiles: store.scenarioProfiles,
    scenarioMetas: store.scenarioMetas,
    activeProfileIds,
    fallbackProfileIds,
  });
}

async function upsertProfileConfig(key: string, value: string, title: string, remark: string) {
  const prisma = await getPrisma();
  const now = new Date();
  const existing = await prisma.tbConfig.findFirst({
    where: { key },
    select: { id: true },
  });

  if (existing) {
    return prisma.tbConfig.update({
      where: { id: existing.id },
      data: {
        value,
        title,
        remark,
        status: 1,
        updated_at: now,
      },
    });
  }

  return prisma.tbConfig.create({
    data: {
      key,
      value,
      title,
      remark,
      status: 1,
      created_at: now,
      updated_at: now,
    },
  });
}

export async function saveAIProfileState(input: unknown): Promise<AIProfileState> {
  const state = normalizeAIProfileState(input);

  await Promise.all([
    upsertProfileConfig(
      AI_PROFILE_STORE_KEY,
      serializeAIProfileStore(state.scenarioProfiles, state.scenarioMetas),
      'AI 场景配置组列表',
      '后台模型场景配置组 JSON，不要手动编辑',
    ),
    upsertProfileConfig(
      AI_ACTIVE_PROFILE_KEY,
      serializeAIProfilePointerMap(state.activeProfileIds),
      '当前激活 AI 场景配置',
      '保存每个模型场景当前使用的配置组 ID',
    ),
    upsertProfileConfig(
      AI_FALLBACK_PROFILE_KEY,
      serializeAIProfilePointerMap(state.fallbackProfileIds),
      'AI 场景降级配置',
      '保存支持降级的模型场景备用配置组 ID 顺序',
    ),
  ]);

  return state;
}

export async function buildLegacyAIProfiles(): Promise<Partial<Record<AIConfigScenario, AIConfigProfile>>> {
  const allKeys = Array.from(
    new Set(
      AI_CONFIG_SCENARIOS.flatMap((scenario) => Object.values(LEGACY_FIELD_KEYS[scenario])),
    ),
  ).filter((key): key is string => Boolean(key));
  const configs = await configByKeys(allKeys);
  const legacyProfiles: Partial<Record<AIConfigScenario, AIConfigProfile>> = {};

  for (const scenario of AI_CONFIG_SCENARIOS) {
    const fields = LEGACY_FIELD_KEYS[scenario];
    const scenarioConfig: AIProfileScenarioConfig = {};

    for (const [field, key] of Object.entries(fields) as Array<[keyof AIProfileScenarioConfig, string]>) {
      const value = configs[key]?.value;
      if (value) {
        scenarioConfig[field] = value;
      }
    }

    if (Object.keys(scenarioConfig).length > 0) {
      legacyProfiles[scenario] = {
        id: `${scenario}-legacy-current`,
        name: '当前散配置',
        description: '从现有单项配置读取，仅用于迁移到该场景配置组',
        config: scenarioConfig,
      };
    }
  }

  return legacyProfiles;
}
