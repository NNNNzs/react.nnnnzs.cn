/**
 * 根据表单中的供应商地址和密钥拉取候选模型。
 * POST /api/config/ai/providers/fetch-models
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { fetchModelsFromProvider } from '@/services/ai-provider';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = {
  code: 'config_ai_provider_fetch_models_from_form',
  name: '根据表单拉取供应商模型',
  module: 'config',
  method: 'POST',
  permissionCode: CONFIG_EDIT,
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const payload: unknown = await request.json();
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json(errorResponse('请求参数无效'), { status: 400 });
    }
    const body = payload as { base_url?: unknown; api_key?: unknown };
    if (typeof body.base_url !== 'string' || !body.base_url.trim()) {
      return NextResponse.json(errorResponse('请先填写 Base URL'), { status: 400 });
    }
    if (typeof body.api_key !== 'string' || !body.api_key.trim()) {
      return NextResponse.json(errorResponse('请先填写 API Key'), { status: 400 });
    }

    const result = await fetchModelsFromProvider(body.base_url, body.api_key);
    if (!result.ok) {
      return NextResponse.json(
        successResponse({ ok: false, error: result.error }, `拉取失败: ${result.error}`),
        { headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      successResponse({ ok: true, models: result.models }, '候选模型已拉取'),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('拉取模型列表失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '拉取模型列表失败'),
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
