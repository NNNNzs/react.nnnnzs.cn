/**
 * AI 场景绑定详情 API
 * DELETE /api/config/ai/bindings/[id]    删除绑定
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { deleteBinding } from '@/services/ai-scenario-binding';
import { clearAIConfigCache } from '@/lib/ai-config';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const deleteDescriptor: ApiDescriptor = {
  code: 'config_ai_binding_delete',
  name: '删除 AI 场景绑定',
  module: 'config',
  method: 'DELETE',
  permissionCode: CONFIG_EDIT,
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { id } = await params;
    const bindingId = parseInt(id, 10);
    if (isNaN(bindingId)) {
      return NextResponse.json(errorResponse('无效的绑定 ID'), { status: 400 });
    }

    await deleteBinding(bindingId);
    clearAIConfigCache();
    return NextResponse.json(successResponse(null, '绑定已删除'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('删除 AI 场景绑定失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '删除 AI 场景绑定失败'),
      { status: 500 },
    );
  }
}
