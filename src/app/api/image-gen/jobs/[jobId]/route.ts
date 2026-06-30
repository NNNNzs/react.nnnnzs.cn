/**
 * 图片生成任务状态 API
 * GET /api/image-gen/jobs/[jobId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { IMAGE_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { getImageGenerationJob } from '@/services/image-gen-job';
import { isUuid } from '@/lib/uuid';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';
interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export const descriptor: ApiDescriptor = {
  code: 'image_gen_job_get',
  name: '图片生成任务状态',
  description: '查询图片生成异步任务状态，可通过 jobId 获取预分配 URL、完成状态和错误信息',
  module: 'image',
  method: 'GET',
  permissionCode: IMAGE_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: '图片生成任务 UUID' },
    },
    required: ['jobId'],
  },
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, IMAGE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { jobId } = await context.params;
    if (!isUuid(jobId)) {
      return NextResponse.json(errorResponse('无效的任务 ID'), { status: 400 });
    }

    const job = await getImageGenerationJob(jobId, check.user);
    if (!job) {
      return NextResponse.json(errorResponse('图片生成任务不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(job), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('查询图片生成任务失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询图片生成任务失败'),
      { status: 500 },
    );
  }
}
