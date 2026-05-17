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
import { IMAGE_VIEW } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';
import { generateImage } from '@/services/image-gen';
import type { ImageGenOptions } from '@/services/image-gen';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'image_gen',
  name: 'AI图片生成',
  description: '使用 AI 生成图片，支持文生图和图文编辑模式',
  module: 'image',
  method: 'POST',
  permissionCode: IMAGE_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', description: '模式：generate（文生图）或 edit（图文编辑）' },
      prompt: { type: 'string', description: '提示词' },
      image: { type: 'string', description: '参考图片URL（编辑模式必填）' },
      size: { type: 'string', description: '图片尺寸，如 1024x1024' },
      quality: { type: 'string', description: '图片质量：high 或 medium' },
    },
    required: ['mode', 'prompt'],
  },
};

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

    const body: ImageGenOptions = await request.json();
    const startTime = Date.now();

    const result = await generateImage(body);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json(
      successResponse({
        ...result,
        elapsed: `${elapsed}s`,
      })
    );
  } catch (error) {
    console.error('Image generation error:', error);
    const errorMessage = error instanceof Error ? error.message : '图片生成失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
