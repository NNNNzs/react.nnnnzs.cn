/**
 * TTS 任务重试 API
 * POST /api/tts/jobs/[jobId]/retry
 * 重试失败的 TTS 语音合成任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { TTS_VIEW } from '@/constants/permissions';
import { isUuid } from '@/lib/uuid';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'tts_job_retry',
  name: '重试TTS任务',
  description: '重试失败的 TTS 语音合成任务',
  module: 'tts',
  method: 'POST',
  permissionCode: TTS_VIEW,
};

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 权限检查
    const check = await requirePermission(request, TTS_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { jobId } = await context.params;

    // 校验 jobId 格式
    if (!isUuid(jobId)) {
      return NextResponse.json(errorResponse('无效的任务 ID'), { status: 400 });
    }

    const { retryTTSJob } = await import('@/services/tts-job');
    const job = await retryTTSJob(jobId, check.user);

    return NextResponse.json(
      successResponse(job, '任务已重新提交'),
      {
        status: 202,
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('TTS job retry error:', error);
    const errorMessage = error instanceof Error ? error.message : '重试任务失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
