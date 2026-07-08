/**
 * AI 供应商 API
 * GET    /api/config/ai/providers      列出全部供应商
 * POST   /api/config/ai/providers      新建供应商
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT, CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { createProvider, listProviders } from '@/services/ai-provider';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const getDescriptor: ApiDescriptor = {
  code: 'config_ai_providers_get',
  name: '获取 AI 供应商列表',
  module: 'config',
  method: 'GET',
  permissionCode: CONFIG_VIEW,
};

export const createDescriptor: ApiDescriptor = {
  code: 'config_ai_providers_create',
  name: '新建 AI 供应商',
  module: 'config',
  method: 'POST',
  permissionCode: CONFIG_EDIT,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '供应商显示名' },
      base_url: { type: 'string', description: 'OpenAI 兼容 base url' },
      api_key: { type: 'string', description: 'API Key' },
      models: { type: 'array', items: { type: 'string' }, description: '可用模型清单' },
      status: { type: 'integer', description: '1 启用 0 停用' },
      remark: { type: 'string' },
    },
    required: ['name', 'base_url', 'api_key'],
  },
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const providers = await listProviders();
    return NextResponse.json(successResponse(providers), { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('获取 AI 供应商列表失败:', error);
    return NextResponse.json(errorResponse('获取 AI 供应商列表失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const body = await request.json();
    if (!body?.name || !body?.base_url || !body?.api_key) {
      return NextResponse.json(errorResponse('name / base_url / api_key 必填'), { status: 400 });
    }
    const provider = await createProvider(body);
    return NextResponse.json(successResponse(provider, '供应商已创建'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('创建 AI 供应商失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建 AI 供应商失败'),
      { status: 500 },
    );
  }
}
