/**
 * TTS 日志删除 API
 * DELETE /api/tts/logs/[id]
 * 删除 TTS 任务日志记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { USER_MANAGE } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'tts_log_delete',
  name: '删除TTS日志',
  description: '删除 TTS 任务日志记录',
  module: 'tts',
  method: 'DELETE',
  permissionCode: USER_MANAGE,
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // 权限检查（需要 USER_MANAGE 权限）
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const idNum = parseInt(id, 10);

    if (isNaN(idNum) || idNum <= 0) {
      return NextResponse.json(errorResponse('无效的日志 ID'), { status: 400 });
    }

    // 解析请求体（可选 deleteCos 参数）
    let deleteCos = false;
    try {
      const body = await request.json();
      deleteCos = body?.deleteCos === true;
    } catch {
      // 没有请求体或解析失败，使用默认值
    }

    const { deleteAiJobLog } = await import('@/services/ai-job-log');
    const result = await deleteAiJobLog(idNum, { deleteCos, type: 'tts' });

    return NextResponse.json(
      successResponse(result, 'TTS 日志已删除'),
    );
  } catch (error) {
    console.error('TTS log delete error:', error);
    const errorMessage = error instanceof Error ? error.message : '删除 TTS 日志失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
