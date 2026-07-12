/**
 * AI 图片编辑 API
 * POST /api/image-gen/edit
 * 创建图片编辑异步任务，支持多张参考图片。
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { IMAGE_VIEW } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

import type { ImageGenOptions } from '@/services/image-gen';
import { createImageGenerationJob } from '@/services/image-gen-job';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const descriptor: ApiDescriptor = {
  code: 'image_edit',
  name: 'AI图片编辑',
  description: '创建 AI 图片编辑异步任务，支持一张或多张参考图，立即返回 jobId 和预分配 CDN URL',
  module: 'image',
  method: 'POST',
  permissionCode: IMAGE_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '编辑指令' },
      image: { type: 'string', description: '单张参考图片 URL（兼容旧客户端）' },
      images: {
        type: 'array',
        items: { type: 'string' },
        description: '参考图片 URL 列表，支持多图编辑',
      },
      group: { type: 'string', description: '图片任务分组，仅用于管理和筛选，不传给模型' },
    },
    required: ['prompt'],
  },
};

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, IMAGE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json() as Omit<ImageGenOptions, 'mode'> & { group?: string };
    const { group, ...options } = body;

    const job = await createImageGenerationJob({
      options: {
        ...options,
        mode: 'edit',
      },
      userId: check.user.id,
      source: 'ADMIN',
      group,
    });

    return NextResponse.json(
      successResponse(job, '图片编辑任务已提交'),
      {
        status: 202,
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (error) {
    console.error('Image edit error:', error);
    const errorMessage = error instanceof Error ? error.message : '图片编辑失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
