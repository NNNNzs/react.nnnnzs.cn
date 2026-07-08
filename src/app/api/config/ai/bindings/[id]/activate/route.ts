/**
 * AI 场景绑定激活 API
 * POST /api/config/ai/bindings/[id]/activate
 * 事务内重置同场景其它 active，激活目标绑定，并清除 AIConfig 缓存。
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { activateBinding } from '@/services/ai-scenario-binding';
import { clearAIConfigCache } from '@/lib/ai-config';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = {
  code: 'config_ai_binding_activate',
  name: '激活 AI 场景绑定',
  module: 'config',
  method: 'POST',
  permissionCode: CONFIG_EDIT,
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export async function POST(
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

    const binding = await activateBinding(bindingId);
    // 激活切换后立即清缓存，确保 getAIConfig 读到新配置
    clearAIConfigCache();

    return NextResponse.json(successResponse(binding, '绑定已激活'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('激活 AI 场景绑定失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '激活 AI 场景绑定失败'),
      { status: 500 },
    );
  }
}
