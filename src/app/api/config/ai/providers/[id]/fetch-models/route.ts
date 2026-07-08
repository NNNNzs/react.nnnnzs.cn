/**
 * AI 供应商拉取模型列表 API
 * POST /api/config/ai/providers/[id]/fetch-models
 * 调用供应商 /models 接口拉取可用模型清单并回填
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { fetchProviderModels } from '@/services/ai-provider';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = {
  code: 'config_ai_provider_fetch_models',
  name: '拉取供应商模型列表',
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
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return NextResponse.json(errorResponse('无效的供应商 ID'), { status: 400 });
    }

    const result = await fetchProviderModels(providerId);
    if (!result.ok) {
      return NextResponse.json(
        successResponse({ ok: false, error: result.error }, `拉取失败: ${result.error}`),
        { headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      successResponse({ ok: true, models: result.models }, '模型列表已更新'),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('拉取模型列表失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '拉取模型列表失败'),
      { status: 500 },
    );
  }
}
