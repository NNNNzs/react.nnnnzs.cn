/**
 * AI 场景元数据
 * 供 provider/binding 的 service、API、UI 共用。
 * 取代旧 ai-config-profiles.ts 中与 profile 耦合的场景定义。
 */

/** 场景 key 类型（字符串字面量集合，便于类型收敛） */
export type AiScenarioKey =
  | 'chat'
  | 'ai_text'
  | 'description'
  | 'embedding'
  | 'image_gen'
  | 'image_recognition'
  | 'tts'
  | 'create_agent';

/** 场景绑定的可配置字段 */
export type AiBindingField =
  | 'temperature'
  | 'max_tokens'
  | 'dimensions'
  | 'api_mode'
  | 'voice';

export interface AiScenarioMeta {
  key: string;
  label: string;
  description: string;
  /** 该场景需要填写的额外字段（模型/api_key/base_url 由 provider 提供，不在此列） */
  optionalFields: AiBindingField[];
}

/** 全部内置场景，顺序即 UI 展示顺序 */
export const AI_SCENARIOS: readonly AiScenarioMeta[] = [
  {
    key: 'chat',
    label: 'Chat 对话',
    description: '/chat 页面、Chat Agent 和会话标题生成',
    optionalFields: ['temperature', 'max_tokens'],
  },
  {
    key: 'ai_text',
    label: '编辑器 AI 文本',
    description: 'Markdown 编辑器润色、扩写、摘要',
    optionalFields: ['temperature', 'max_tokens'],
  },
  {
    key: 'description',
    label: '文章描述',
    description: '文章描述生成接口',
    optionalFields: ['temperature', 'max_tokens'],
  },
  {
    key: 'create_agent',
    label: '创作 Agent',
    description: '草稿库创作助手 /create/drafts/[id]，需支持 function calling 的模型',
    optionalFields: ['temperature', 'max_tokens'],
  },
  {
    key: 'embedding',
    label: '向量嵌入',
    description: '文章向量化、向量搜索和 RAG 检索',
    optionalFields: ['dimensions'],
  },
  {
    key: 'image_gen',
    label: '图片生成',
    description: '后台图片生成、图片任务重试和 MCP 图片生成',
    optionalFields: ['api_mode'],
  },
  {
    key: 'image_recognition',
    label: '图片识别',
    description: '识图接口 /api/image-gen/recognize 和 MCP 识图工具',
    optionalFields: ['temperature', 'max_tokens'],
  },
  {
    key: 'tts',
    label: 'TTS 语音',
    description: 'MiMo TTS 语音合成',
    optionalFields: ['voice'],
  },
] as const;

export const AI_SCENARIO_KEYS: readonly string[] = AI_SCENARIOS.map((s) => s.key);

export function isAiScenarioKey(value: string): boolean {
  return AI_SCENARIO_KEYS.includes(value);
}

export function getAiScenarioMeta(key: string): AiScenarioMeta | undefined {
  return AI_SCENARIOS.find((s) => s.key === key);
}

/** 绑定字段的中文标签 */
export const AI_BINDING_FIELD_LABELS: Record<AiBindingField, string> = {
  temperature: '温度',
  max_tokens: '最大 Token',
  dimensions: '向量维度',
  api_mode: '接口模式',
  voice: '默认音色',
};
