/**
 * TTS 任务查询 API
 * GET /api/tts/jobs/[jobId]
 * 查询 TTS 语音合成任务状态
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
  code: 'tts_job_get',
  name: '查询TTS任务',
  description: '查询 TTS 语音合成任务状态',
  module: 'tts',
  method: 'GET',
  permissionCode: TTS_VIEW,
};

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
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

    const { getTTSJob } = await import('@/services/tts-job');
    const job = await getTTSJob(jobId, check.user);

    if (!job) {
      return NextResponse.json(errorResponse('任务不存在或无权访问'), { status: 404 });
    }

    return NextResponse.json(
      successResponse(job),
      {
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('TTS job query error:', error);
    const errorMessage = error instanceof Error ? error.message : '查询任务失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
