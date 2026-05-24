/**
 * AI 图片生成 API
 * POST /api/image-gen
 * 根据 image_gen.api_mode 配置调用 /v1/chat/completions 或 /v1/images/generations
 * 支持文生图、图文编辑
 * 自动转存到 CDN 并记录日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { IMAGE_VIEW } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';
import { generateImageWithLog } from '@/services/image-gen';
import type { ImageGenOptions } from '@/services/image-gen';

export const maxDuration = 300;

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'image_gen',
  name: 'AI图片生成',
  description: '使用 AI 生成图片，支持 chat_completions 和 images_generations 两种接口模式',
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
    // 权限检查
    const check = await requirePermission(request, IMAGE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body: ImageGenOptions = await request.json();
    const startTime = Date.now();

    // 使用完整流程：生成 + 转存 + 日志
    const result = await generateImageWithLog(body, check.user.id, 'ADMIN');
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json(
      successResponse({
        imageUrl: result.imageUrl,
        model: result.model,
        elapsed: `${elapsed}s`,
      })
    );
  } catch (error) {
    console.error('Image generation error:', error);
    const errorMessage = error instanceof Error ? error.message : '图片生成失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
