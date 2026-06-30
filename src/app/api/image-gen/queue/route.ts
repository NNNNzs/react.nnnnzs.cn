/**
 * 图片生成队列监控 API
 * GET /api/image-gen/queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { QUEUE_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { getImageGenerationMonitorView } from '@/services/image-gen-job';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, QUEUE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const data = await getImageGenerationMonitorView();

    return NextResponse.json(successResponse(data), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('查询图片生成队列监控失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询图片生成队列监控失败'),
      { status: 500 },
    );
  }
}
