/**
 * AI 场景绑定 API
 * GET   /api/config/ai/bindings          列出全部绑定（按 scenario 分组）
 * PUT   /api/config/ai/bindings          批量 upsert 绑定（新建/更新）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT, CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import {
  createBinding,
  listBindingsGrouped,
  updateBinding,
} from '@/services/ai-scenario-binding';
import { getAllScenarios } from '@/services/ai-scenario';
import { clearAIConfigCache } from '@/lib/ai-config';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const getDescriptor: ApiDescriptor = {
  code: 'config_ai_bindings_get',
  name: '获取 AI 场景绑定列表',
  module: 'config',
  method: 'GET',
  permissionCode: CONFIG_VIEW,
};

export const updateDescriptor: ApiDescriptor = {
  code: 'config_ai_bindings_update',
  name: '创建/更新 AI 场景绑定',
  module: 'config',
  method: 'PUT',
  permissionCode: CONFIG_EDIT,
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const grouped = await listBindingsGrouped();
    const scenarios = await getAllScenarios();
    return NextResponse.json(
      successResponse({
        bindings: grouped,
        /** 场景元数据，供前端渲染 tab 标题和字段提示 */
        scenarios,
      }),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('获取 AI 场景绑定失败:', error);
    return NextResponse.json(errorResponse('获取 AI 场景绑定失败'), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json();
    const { id, ...input } = body;

    let binding;
    if (id) {
      binding = await updateBinding(id, input);
    } else {
      binding = await createBinding(input);
    }
    clearAIConfigCache();

    return NextResponse.json(successResponse(binding, id ? '绑定已更新' : '绑定已创建'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('保存 AI 场景绑定失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '保存 AI 场景绑定失败'),
      { status: 500 },
    );
  }
}
