/**
 * 图片生成任务重试 API
 * POST /api/image-gen/jobs/[jobId]/retry
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { IMAGE_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { retryImageGenerationJob } from '@/services/image-gen-job';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, IMAGE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { jobId } = await context.params;
    if (!isUuid(jobId)) {
      return NextResponse.json(errorResponse('无效的任务 ID'), { status: 400 });
    }

    const job = await retryImageGenerationJob(jobId, check.user);

    return NextResponse.json(successResponse(job, '任务已重新入队'), {
      status: 202,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('重试图片生成任务失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '重试图片生成任务失败'),
      { status: 500 },
    );
  }
}
