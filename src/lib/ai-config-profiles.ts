import type { AIConfigScenario } from '@/lib/ai-config';

export const AI_PROFILE_STORE_KEY = 'ai.profile_groups';
export const AI_ACTIVE_PROFILE_KEY = 'ai.active_profiles';
export const AI_FALLBACK_PROFILE_KEY = 'ai.fallback_profiles';

export const AI_BUILTIN_CONFIG_SCENARIOS = [
  'chat',
  'ai_text',
  'description',
  'embedding',
  'image_gen',
  'tts',
  'create_agent',
] as const satisfies readonly AIConfigScenario[];
export const AI_CONFIG_SCENARIOS = AI_BUILTIN_CONFIG_SCENARIOS;

export const AI_CONFIG_FIELDS = [
  'api_key',
  'model',
  'base_url',
  'temperature',
  'max_tokens',
  'dimensions',
  'api_mode',
  'voice',
] as const;

export type AIConfigField = (typeof AI_CONFIG_FIELDS)[number];

export interface AIProfileScenarioMeta {
  label: string;
  description: string;
  requiredFields: AIConfigField[];
  optionalFields: AIConfigField[];
}

export const AI_SCENARIO_META: Record<string, AIProfileScenarioMeta> = {
  chat: {
    label: 'Chat 对话',
    description: '/chat 页面、Chat Agent 和会话标题生成',
    requiredFields: ['api_key', 'model', 'base_url'],
    optionalFields: ['temperature', 'max_tokens'],
  },
  ai_text: {
    label: '编辑器 AI 文本',
    description: 'Markdown 编辑器润色、扩写、摘要',
    requiredFields: ['api_key', 'model', 'base_url'],
    optionalFields: ['temperature', 'max_tokens'],
  },
  description: {
    label: '文章描述',
    description: '文章描述生成接口',
    requiredFields: ['api_key', 'model', 'base_url'],
    optionalFields: ['temperature', 'max_tokens'],
  },
  embedding: {
    label: '向量嵌入',
    description: '文章向量化、向量搜索和 RAG 检索',
    requiredFields: ['api_key', 'model', 'base_url'],
    optionalFields: ['dimensions'],
  },
  image_gen: {
    label: '图片生成',
    description: '后台图片生成、图片任务重试和 MCP 图片生成',
    requiredFields: ['api_key', 'model', 'base_url'],
    optionalFields: ['api_mode'],
  },
  tts: {
    label: 'TTS 语音',
    description: 'MiMo TTS 语音合成',
    requiredFields: ['api_key', 'model', 'base_url'],
    optionalFields: ['voice'],
  },
  create_agent: {
    label: '创作 Agent',
    description: '草稿库创作助手 /create/drafts/[id]，需支持 function calling 的模型',
    requiredFields: ['api_key', 'model', 'base_url'],
    optionalFields: ['temperature', 'max_tokens'],
  },
};

export const AI_FIELD_LABELS: Record<AIConfigField, string> = {
  api_key: 'API Key',
  model: '模型',
  base_url: 'Base URL',
  temperature: '温度',
  max_tokens: '最大 Token',
  dimensions: '向量维度',
  api_mode: '接口模式',
  voice: '默认音色',
};

export interface AIProfileScenarioConfig {
  api_key?: string;
  model?: string;
  base_url?: string;
  temperature?: string;
  max_tokens?: string;
  dimensions?: string;
  api_mode?: string;
  voice?: string;
}

export interface AIConfigProfile {
  id: string;
  name: string;
  description?: string;
  config: AIProfileScenarioConfig;
}

export type AIScenarioProfileMap = Partial<Record<AIConfigScenario, AIConfigProfile[]>>;
export type AIActiveProfileMap = Partial<Record<AIConfigScenario, string>>;
export type AIFallbackProfileMap = Partial<Record<AIConfigScenario, string[]>>;

export interface AIProfileStore {
  version: 1;
  scenarioProfiles: AIScenarioProfileMap;
  scenarioMetas: Record<string, AIProfileScenarioMeta>;
}

export interface AIProfileState extends AIProfileStore {
  activeProfileIds: AIActiveProfileMap;
  fallbackProfileIds: AIFallbackProfileMap;
}

export function normalizeAIScenarioKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeScenarioConfig(value: unknown): AIProfileScenarioConfig {
  if (!isRecord(value)) {
    return {};
  }

  const config: AIProfileScenarioConfig = {};
  for (const field of AI_CONFIG_FIELDS) {
    const fieldValue = cleanString(value[field]);
    if (fieldValue !== undefined) {
      config[field] = fieldValue;
    }
  }
  return config;
}

function normalizeFields(value: unknown): AIConfigField[] {
  const allowedFields = new Set<string>(AI_CONFIG_FIELDS);
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(cleanString)
    .filter((field): field is string => Boolean(field))
    .filter((field): field is AIConfigField => allowedFields.has(field))
    .filter((field, index, fields) => fields.indexOf(field) === index);
}

function normalizeScenarioMeta(key: string, value: unknown): AIProfileScenarioMeta {
  if (!isRecord(value)) {
    return {
      label: key,
      description: '',
      requiredFields: ['api_key', 'model', 'base_url'],
      optionalFields: ['temperature', 'max_tokens'],
    };
  }

  const requiredFields = normalizeFields(value.requiredFields);
  const optionalFields = normalizeFields(value.optionalFields).filter((field) => !requiredFields.includes(field));

  return {
    label: cleanString(value.label) ?? key,
    description: cleanString(value.description) ?? '',
    requiredFields: requiredFields.length > 0 ? requiredFields : ['api_key', 'model', 'base_url'],
    optionalFields,
  };
}

function normalizeProfile(value: unknown): AIConfigProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = cleanString(value.id);
  const name = cleanString(value.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    description: cleanString(value.description),
    config: normalizeScenarioConfig(value.config),
  };
}

function normalizeScenarioMetas(value: unknown, scenarioProfilesValue: unknown): Record<string, AIProfileScenarioMeta> {
  const rawMetas = isRecord(value) ? value : {};
  const rawScenarioProfiles = isRecord(scenarioProfilesValue) ? scenarioProfilesValue : {};
  const scenarioKeys = [
    ...AI_BUILTIN_CONFIG_SCENARIOS,
    ...Object.keys(rawMetas).map(normalizeAIScenarioKey),
    ...Object.keys(rawScenarioProfiles).map(normalizeAIScenarioKey),
  ].filter((key, index, keys) => Boolean(key) && keys.indexOf(key) === index);

  return scenarioKeys.reduce<Record<string, AIProfileScenarioMeta>>((acc, scenario) => {
    acc[scenario] = normalizeScenarioMeta(scenario, rawMetas[scenario] ?? AI_SCENARIO_META[scenario]);
    return acc;
  }, {});
}

function normalizeScenarioProfiles(value: unknown, scenarioMetas: Record<string, AIProfileScenarioMeta>): AIScenarioProfileMap {
  const rawScenarioProfiles = isRecord(value) ? value : {};
  const scenarioProfiles: AIScenarioProfileMap = {};

  for (const scenario of Object.keys(scenarioMetas)) {
    const rawProfiles = rawScenarioProfiles[scenario];
    const profiles = Array.isArray(rawProfiles)
      ? rawProfiles
          .map(normalizeProfile)
          .filter((profile): profile is AIConfigProfile => profile !== null)
      : [];

    scenarioProfiles[scenario] = profiles;
  }

  return scenarioProfiles;
}

function normalizeActiveProfiles(
  value: unknown,
  scenarioProfiles: AIScenarioProfileMap,
  scenarioMetas: Record<string, AIProfileScenarioMeta>,
): AIActiveProfileMap {
  const rawActiveProfiles = isRecord(value) ? value : {};
  const activeProfileIds: AIActiveProfileMap = {};

  for (const scenario of Object.keys(scenarioMetas)) {
    const profiles = scenarioProfiles[scenario] ?? [];
    const activeProfileId = cleanString(rawActiveProfiles[scenario]);
    activeProfileIds[scenario] = profiles.some((profile) => profile.id === activeProfileId)
      ? activeProfileId
      : profiles[0]?.id;
  }

  return activeProfileIds;
}

function normalizeFallbackProfiles(
  value: unknown,
  scenarioProfiles: AIScenarioProfileMap,
  activeProfileIds: AIActiveProfileMap,
  scenarioMetas: Record<string, AIProfileScenarioMeta>,
): AIFallbackProfileMap {
  const rawFallbackProfiles = isRecord(value) ? value : {};
  const fallbackProfileIds: AIFallbackProfileMap = {};

  for (const scenario of Object.keys(scenarioMetas)) {
    const profileIds = new Set((scenarioProfiles[scenario] ?? []).map((profile) => profile.id));
    const activeProfileId = activeProfileIds[scenario];
    const rawIds = Array.isArray(rawFallbackProfiles[scenario])
      ? rawFallbackProfiles[scenario]
      : [];

    fallbackProfileIds[scenario] = rawIds
      .map(cleanString)
      .filter((id): id is string => Boolean(id))
      .filter((id, index, ids) => profileIds.has(id) && id !== activeProfileId && ids.indexOf(id) === index);
  }

  return fallbackProfileIds;
}

export function parseAIProfileStore(rawValue: string | null | undefined): AIProfileStore {
  if (!rawValue) {
    const scenarioMetas = normalizeScenarioMetas({}, {});
    return { version: 1, scenarioProfiles: normalizeScenarioProfiles({}, scenarioMetas), scenarioMetas };
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    const scenarioMetas = isRecord(parsed)
      ? normalizeScenarioMetas(parsed.scenarioMetas, parsed.scenarioProfiles)
      : normalizeScenarioMetas({}, {});
    const scenarioProfiles = isRecord(parsed)
      ? normalizeScenarioProfiles(parsed.scenarioProfiles, scenarioMetas)
      : normalizeScenarioProfiles({}, scenarioMetas);
    return { version: 1, scenarioProfiles, scenarioMetas };
  } catch {
    const scenarioMetas = normalizeScenarioMetas({}, {});
    return { version: 1, scenarioProfiles: normalizeScenarioProfiles({}, scenarioMetas), scenarioMetas };
  }
}

export function parseAIProfilePointerMap(rawValue: string | null | undefined): unknown {
  if (!rawValue) {
    return {};
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return {};
  }
}

export function normalizeAIProfileState(input: unknown): AIProfileState {
  const scenarioMetas = isRecord(input)
    ? normalizeScenarioMetas(input.scenarioMetas, input.scenarioProfiles)
    : normalizeScenarioMetas({}, {});
  const scenarioProfiles = isRecord(input)
    ? normalizeScenarioProfiles(input.scenarioProfiles, scenarioMetas)
    : normalizeScenarioProfiles({}, scenarioMetas);
  const activeProfileIds = normalizeActiveProfiles(
    isRecord(input) ? input.activeProfileIds : {},
    scenarioProfiles,
    scenarioMetas,
  );
  const fallbackProfileIds = normalizeFallbackProfiles(
    isRecord(input) ? input.fallbackProfileIds : {},
    scenarioProfiles,
    activeProfileIds,
    scenarioMetas,
  );

  return {
    version: 1,
    scenarioProfiles,
    scenarioMetas,
    activeProfileIds,
    fallbackProfileIds,
  };
}

export function serializeAIProfileStore(
  scenarioProfiles: AIScenarioProfileMap,
  scenarioMetas: Record<string, AIProfileScenarioMeta>,
): string {
  return JSON.stringify({ version: 1, scenarioProfiles, scenarioMetas }, null, 2);
}

export function serializeAIProfilePointerMap(pointerMap: AIActiveProfileMap | AIFallbackProfileMap): string {
  return JSON.stringify(pointerMap, null, 2);
}

export function getActiveProfileValues(
  state: AIProfileState,
  scenario: AIConfigScenario,
): AIProfileScenarioConfig | null {
  const activeProfileId = state.activeProfileIds[scenario];
  if (!activeProfileId) {
    return null;
  }

  const profile = (state.scenarioProfiles[scenario] ?? []).find((item) => item.id === activeProfileId);
  return profile?.config ?? null;
}

export function getProfileConfigCandidates(
  state: AIProfileState,
  scenario: AIConfigScenario,
): AIProfileScenarioConfig[] {
  const profiles = state.scenarioProfiles[scenario] ?? [];
  const activeProfileId = state.activeProfileIds[scenario];
  const fallbackIds = state.fallbackProfileIds[scenario] ?? [];
  const orderedIds = [activeProfileId, ...fallbackIds].filter((id): id is string => Boolean(id));

  return orderedIds
    .map((id) => profiles.find((profile) => profile.id === id)?.config)
    .filter((config): config is AIProfileScenarioConfig => Boolean(config));
}

export function getAIScenarioKeys(state: Pick<AIProfileState, 'scenarioMetas'>): AIConfigScenario[] {
  return Object.keys(state.scenarioMetas);
}
