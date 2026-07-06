/**
 * TTS 语音合成核心服务
 *
 * 抽离自 src/app/api/tts/synthesize/route.ts 的 MiMo 调用逻辑。
 * 保持原有业务逻辑不变：
 * - 使用 `api-key` header（MiMo 特有，不是 Bearer）
 * - messages 结构：instruction → role:'user'，text → role:'assistant'（MiMo 强制要求）
 */

import { getAIConfig } from '@/lib/ai-config';

/**
 * 支持的模型列表
 */
export const TTS_SUPPORTED_MODELS = [
  'mimo-v2.5-tts',
  'mimo-v2.5-tts-voicedesign',
  'mimo-v2.5-tts-voiceclone',
  'mimo-v2-tts',
] as const;

/**
 * 支持的音色列表（按模型分组）
 */
export const TTS_VOICE_MAP: Record<string, string[]> = {
  'mimo-v2.5-tts': ['冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean'],
  'mimo-v2.5-tts-voicedesign': [],
  'mimo-v2.5-tts-voiceclone': [],
  'mimo-v2-tts': ['mimo_default', 'default_zh', 'default_en'],
};

/**
 * TTS 选项
 */
export interface TtsOptions {
  text: string;
  model?: string;        // 不传则用 config.model 或 'mimo-v2.5-tts'
  voice?: string;        // 不传则用 config.voice 或 '冰糖'
  instruction?: string;  // 风格指令
}

/**
 * TTS 结果
 */
export interface TtsResult {
  audioBase64: string;   // 上游返回的 base64 音频
  format: 'wav';
  model: string;         // 实际生效模型（fallback 后）
  voice: string;         // 实际生效音色（fallback 后）
}

/**
 * 校验 TTS 选项
 */
export function validateTtsOptions(options: TtsOptions): void {
  if (!options.text || typeof options.text !== 'string' || options.text.trim().length === 0) {
    throw new Error('合成文本不能为空');
  }

  if (options.model && !TTS_SUPPORTED_MODELS.includes(options.model as typeof TTS_SUPPORTED_MODELS[number])) {
    throw new Error(`不支持的模型: ${options.model}`);
  }
}

/**
 * 调用 MiMo TTS API 合成语音
 *
 * 关键实现细节：
 * 1. 使用 `api-key` header（不是 Authorization: Bearer）
 * 2. messages 结构：instruction → role:'user'，text → role:'assistant'
 * 3. audio 参数：format:'wav'，可选 voice
 */
export async function synthesizeSpeech(options: TtsOptions): Promise<TtsResult> {
  validateTtsOptions(options);

  const config = await getAIConfig('tts');
  const apiKey = config.api_key;
  const baseUrl = config.base_url;
  const model = options.model || config.model || 'mimo-v2.5-tts';
  const voice = options.voice || config.voice || '冰糖';

  // 构造 messages
  const messages: Array<{ role: string; content: string }> = [];

  // 风格指令放在 user message 中
  if (options.instruction && options.instruction.trim()) {
    messages.push({
      role: 'user',
      content: options.instruction.trim(),
    });
  }

  // 合成文本放在 assistant message 中（MiMo TTS 要求）
  messages.push({
    role: 'assistant',
    content: options.text.trim(),
  });

  // 构造音频参数
  const audioParams: Record<string, string> = {
    format: 'wav',
  };

  // 如果模型支持内置音色且指定了音色
  const availableVoices = TTS_VOICE_MAP[model] || [];
  if (availableVoices.length > 0 && voice) {
    audioParams.voice = voice;
  } else if (model === 'mimo-v2.5-tts') {
    audioParams.voice = voice;
  }

  // 调用 MiMo TTS API
  const apiEndpoint = `${baseUrl || 'https://api.xiaomimimo.com/v1'}/chat/completions`;

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'api-key': apiKey,  // MiMo 特有，不是 Authorization: Bearer
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      audio: audioParams,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('MiMo TTS API error:', response.status, errorText);
    // 尝试解析 JSON 错误体，提取更友好的错误信息
    let detail = errorText.slice(0, 500);
    try {
      const errorJson = JSON.parse(errorText);
      detail = errorJson?.error?.message || errorJson?.message || errorJson?.error?.type || JSON.stringify(errorJson).slice(0, 500);
    } catch {
      // 非 JSON 响应，使用原始文本
    }
    throw new Error(`TTS API 调用失败 (${response.status}): ${detail}`);
  }

  const result = await response.json();

  // 检查 MiMo API 返回的业务错误（HTTP 200 但内容为错误信息）
  const apiError = result?.error?.message || result?.error?.type;
  if (apiError) {
    console.error('MiMo TTS API business error:', JSON.stringify(result).slice(0, 500));
    throw new Error(`TTS API 错误: ${apiError}`);
  }

  // 提取音频数据
  const audioData = result?.choices?.[0]?.message?.audio?.data;
  if (!audioData) {
    console.error('MiMo TTS API unexpected response:', JSON.stringify(result).slice(0, 500));
    throw new Error(`TTS API 返回数据异常，未包含音频数据。响应: ${JSON.stringify(result).slice(0, 300)}`);
  }

  return {
    audioBase64: audioData,
    format: 'wav',
    model,
    voice: audioParams.voice || '',
  };
}
