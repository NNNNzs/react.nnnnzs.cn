/**
 * TTS 队列监控 API
 * GET /api/tts/queue
 * 获取 TTS 队列状态和任务统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { QUEUE_VIEW } from '@/constants/permissions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, QUEUE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { getTtsMonitorView } = await import('@/services/tts-job');
    const monitor = await getTtsMonitorView();

    return NextResponse.json(successResponse(monitor));
  } catch (error) {
    console.error('TTS queue monitor error:', error);
    const errorMessage = error instanceof Error ? error.message : '获取 TTS 队列状态失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
