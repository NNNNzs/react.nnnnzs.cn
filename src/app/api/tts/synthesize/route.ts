/**
 * TTS 语音合成 API
 * POST /api/tts/synthesize
 * 调用小米 MiMo TTS API 生成语音
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getAIConfigValue } from '@/lib/ai-config';
import { TTS_VIEW } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'tts_synthesize',
  name: '语音合成',
  description: '使用 MiMo TTS 生成语音，支持多种音色和风格',
  module: 'tts',
  method: 'POST',
  permissionCode: TTS_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要合成的文本' },
      model: { type: 'string', description: 'TTS 模型' },
      voice: { type: 'string', description: '音色名称' },
      instruction: { type: 'string', description: '风格指令' },
    },
    required: ['text'],
  },
};

/**
 * 支持的模型列表
 */
const SUPPORTED_MODELS = [
  'mimo-v2.5-tts',
  'mimo-v2.5-tts-voicedesign',
  'mimo-v2.5-tts-voiceclone',
  'mimo-v2-tts',
];

/**
 * 支持的音色列表（按模型分组）
 */
const VOICE_MAP: Record<string, string[]> = {
  'mimo-v2.5-tts': ['冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean'],
  'mimo-v2.5-tts-voicedesign': [],
  'mimo-v2.5-tts-voiceclone': [],
  'mimo-v2-tts': ['mimo_default', 'default_zh', 'default_en'],
};

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, TTS_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    // 解析请求体
    const body = await request.json();
    const {
      text,
      model: requestedModel,
      voice: requestedVoice,
      instruction,
    } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(errorResponse('合成文本不能为空'), { status: 400 });
    }

    // 从数据库读取 TTS 配置
    const [apiKey, baseUrl, defaultModel, defaultVoice] = await Promise.all([
      getAIConfigValue('tts.api_key'),
      getAIConfigValue('tts.base_url'),
      getAIConfigValue('tts.default_model', 'mimo-v2.5-tts'),
      getAIConfigValue('tts.default_voice', '冰糖'),
    ]);

    if (!apiKey) {
      return NextResponse.json(errorResponse('TTS API 密钥未配置，请在配置管理中设置 tts.api_key'), { status: 500 });
    }

    const model = requestedModel || defaultModel || 'mimo-v2.5-tts';
    const voice = requestedVoice || defaultVoice || '冰糖';

    // 验证模型
    if (!SUPPORTED_MODELS.includes(model)) {
      return NextResponse.json(errorResponse(`不支持的模型: ${model}`), { status: 400 });
    }

    // 构造 messages
    const messages: Array<{ role: string; content: string }> = [];

    // 风格指令放在 user message 中
    if (instruction && instruction.trim()) {
      messages.push({
        role: 'user',
        content: instruction.trim(),
      });
    }

    // 合成文本放在 assistant message 中（MiMo TTS 要求）
    messages.push({
      role: 'assistant',
      content: text.trim(),
    });

    // 构造音频参数
    const audioParams: Record<string, string> = {
      format: 'wav',
    };

    // 如果模型支持内置音色且指定了音色
    const availableVoices = VOICE_MAP[model] || [];
    if (availableVoices.length > 0 && voice) {
      audioParams.voice = voice;
    } else if (model === 'mimo-v2.5-tts') {
      audioParams.voice = voice;
    }

    // 调用 MiMo TTS API
    const apiEndpoint = `${baseUrl || 'https://api.xiaomimimo.com/v1'}/chat/completions`;

    const startTime = Date.now();
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        audio: audioParams,
      }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

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
      return NextResponse.json(
        errorResponse(`TTS API 调用失败 (${response.status}): ${detail}`),
        { status: 502 }
      );
    }

    const result = await response.json();

    // 检查 MiMo API 返回的业务错误（HTTP 200 但内容为错误信息）
    const apiError = result?.error?.message || result?.error?.type;
    if (apiError) {
      console.error('MiMo TTS API business error:', JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        errorResponse(`TTS API 错误: ${apiError}`),
        { status: 502 }
      );
    }

    // 提取音频数据
    const audioData = result?.choices?.[0]?.message?.audio?.data;
    if (!audioData) {
      console.error('MiMo TTS API unexpected response:', JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        errorResponse(`TTS API 返回数据异常，未包含音频数据。响应: ${JSON.stringify(result).slice(0, 300)}`),
        { status: 502 }
      );
    }

    return NextResponse.json(
      successResponse({
        audio: audioData,
        format: 'wav',
        elapsed: `${elapsed}s`,
        model,
        voice: audioParams.voice || '',
      }, '语音合成成功')
    );
  } catch (error) {
    console.error('TTS synthesis error:', error);
    const errorMessage = error instanceof Error ? error.message : '语音合成失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
