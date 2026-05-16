/**
 * AI 图片生成 API
 * POST /api/image-gen
 * 通过 /v1/chat/completions 调用 GPT Image 2
 * 支持文生图、图文编辑
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, validateToken } from '@/lib/auth';
import { isAdmin } from '@/types/role';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getAIConfigValues } from '@/lib/ai-config';


const VALID_QUALITIES = ['high', 'medium'] as const;

const IMAGE_URL_REGEX = /!\[image\]\((https?:\/\/[^\s)]+)\)/;

interface ImageGenRequest {
  mode: 'generate' | 'edit';
  prompt: string;
  image?: string;
  size?: string;
  quality?: string;
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request.headers);
    if (!token) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }
    const user = await validateToken(token);
    if (!user) {
      return NextResponse.json(errorResponse('登录已过期'), { status: 401 });
    }
    if (!isAdmin(user.role)) {
      return NextResponse.json(errorResponse('无权限访问'), { status: 403 });
    }

    const body: ImageGenRequest = await request.json();
    const { mode, prompt, image, size, quality } = body;

    if (!mode || !['generate', 'edit'].includes(mode)) {
      return NextResponse.json(errorResponse('无效的模式，仅支持 generate 或 edit'), { status: 400 });
    }
    if (!prompt?.trim()) {
      return NextResponse.json(errorResponse('提示词不能为空'), { status: 400 });
    }
    if (mode === 'edit' && !image?.trim()) {
      return NextResponse.json(errorResponse('编辑模式需要提供参考图片'), { status: 400 });
    }
    if (size && !/^\d+x\d+$/.test(size)) {
      return NextResponse.json(errorResponse(`尺寸格式错误，应为 宽x高，如 1024x1024`), { status: 400 });
    }
    if (quality && !VALID_QUALITIES.includes(quality as typeof VALID_QUALITIES[number])) {
      return NextResponse.json(errorResponse(`不支持的质量: ${quality}，可选: ${VALID_QUALITIES.join(', ')}`), { status: 400 });
    }

    const configs = await getAIConfigValues([
      'image_gen.api_key',
      'image_gen.base_url',
      'image_gen.model',
    ]);

    const apiKey = configs['image_gen.api_key'];
    const baseUrl = configs['image_gen.base_url'];
    const model = configs['image_gen.model'] || 'gpt-image-2';

    if (!apiKey) {
      return NextResponse.json(errorResponse('图片生成 API 密钥未配置，请在配置管理中设置 image_gen.api_key'), { status: 500 });
    }
    if (!baseUrl) {
      return NextResponse.json(errorResponse('图片生成 API 地址未配置，请在配置管理中设置 image_gen.base_url'), { status: 500 });
    }

    // 构造 messages
    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    if (mode === 'edit') {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt.trim() },
          { type: 'image_url', image_url: { url: image!.trim() } },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: prompt.trim(),
      });
    }

    // 构造请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages,
    };

    // 附加尺寸和质量提示（通过 system message）
    if (size || quality) {
      const hints: string[] = [];
      if (size) hints.push(`size: ${size}`);
      if (quality) hints.push(`quality: ${quality}`);
      const currentMessages = messages as Array<{ role: string; content: string }>;
      requestBody.messages = [
        { role: 'system', content: `Generate image with the following constraints: ${hints.join(', ')}` },
        ...currentMessages,
      ];
    }

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
    const startTime = Date.now();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image gen API error:', response.status, errorText);
      let detail = errorText.slice(0, 500);
      try {
        const errorJson = JSON.parse(errorText);
        detail = errorJson?.error?.message || errorJson?.message || detail;
      } catch {
        // 非 JSON 响应
      }
      return NextResponse.json(errorResponse(`API 调用失败 (${response.status}): ${detail}`), { status: 502 });
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content || '';

    const imageUrlMatch = content.match(IMAGE_URL_REGEX);
    if (!imageUrlMatch) {
      console.error('Image gen API unexpected response:', JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        errorResponse(`API 返回数据异常，未包含图片。响应: ${JSON.stringify(result).slice(0, 300)}`),
        { status: 502 }
      );
    }

    return NextResponse.json(
      successResponse({
        imageUrl: imageUrlMatch[1],
        elapsed: `${elapsed}s`,
        model,
      })
    );
  } catch (error) {
    console.error('Image generation error:', error);
    const errorMessage = error instanceof Error ? error.message : '图片生成失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
