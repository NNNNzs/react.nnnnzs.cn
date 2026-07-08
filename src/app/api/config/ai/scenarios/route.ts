/**
 * AI 场景 API
 * GET   /api/config/ai/scenarios      列出全部场景（内置+自定义）
 * POST  /api/config/ai/scenarios      创建自定义场景
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT, CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { createScenario, getAllScenarios } from '@/services/ai-scenario';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const getDescriptor: ApiDescriptor = {
  code: 'config_ai_scenarios_get',
  name: '获取 AI 场景列表',
  module: 'config',
  method: 'GET',
  permissionCode: CONFIG_VIEW,
};

export const createDescriptor: ApiDescriptor = {
  code: 'config_ai_scenarios_create',
  name: '创建 AI 场景',
  module: 'config',
  method: 'POST',
  permissionCode: CONFIG_EDIT,
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const scenarios = await getAllScenarios();
    return NextResponse.json(successResponse(scenarios), { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('获取 AI 场景列表失败:', error);
    return NextResponse.json(errorResponse('获取 AI 场景列表失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const body = await request.json();
    if (!body?.key || !body?.label) {
      return NextResponse.json(errorResponse('key 和 label 必填'), { status: 400 });
    }
    const result = await createScenario(body);
    return NextResponse.json(successResponse(result, '场景已创建'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('创建 AI 场景失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建 AI 场景失败'),
      { status: 500 },
    );
  }
}
