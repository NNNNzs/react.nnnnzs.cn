/**
 * AI 图片生成 API
 * POST /api/image-gen
 * 创建图片生成异步任务
 * 支持文生图、图文编辑
 * 后台队列自动生成、转存到 CDN 并记录日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { IMAGE_VIEW } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';
import type { ImageGenOptions } from '@/services/image-gen';
import { createImageGenerationJob } from '@/services/image-gen-job';

export const maxDuration = 30;

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'image_gen',
  name: 'AI图片生成',
  description: '创建 AI 图片生成异步任务，立即返回 jobId 和预分配 CDN URL，后台队列完成生成和转存',
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

    const job = await createImageGenerationJob({
      options: body,
      userId: check.user.id,
      source: 'ADMIN',
    });

    return NextResponse.json(
      successResponse(job, '图片生成任务已提交'),
      {
        status: 202,
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Image generation error:', error);
    const errorMessage = error instanceof Error ? error.message : '图片生成失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
