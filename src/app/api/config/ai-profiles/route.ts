/**
 * AI 配置组 API
 * GET /api/config/ai-profiles
 * PUT /api/config/ai-profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT, CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { buildLegacyAIProfiles, getAIProfileState, saveAIProfileState } from '@/services/ai-config-profiles';
import { AI_FIELD_LABELS } from '@/lib/ai-config-profiles';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const getDescriptor: ApiDescriptor = {
  code: 'config_ai_profiles_get',
  name: '获取 AI 配置组',
  module: 'config',
  method: 'GET',
  permissionCode: CONFIG_VIEW,
};

export const updateDescriptor: ApiDescriptor = {
  code: 'config_ai_profiles_update',
  name: '更新 AI 配置组',
  module: 'config',
  method: 'PUT',
  permissionCode: CONFIG_EDIT,
  inputSchema: {
    type: 'object',
    properties: {
      scenarioProfiles: { type: 'object', description: '按场景分组的 AI 配置组列表' },
      scenarioMetas: { type: 'object', description: 'AI 应用场景定义' },
      activeProfileIds: { type: 'object', description: '各场景当前激活配置组 ID' },
      fallbackProfileIds: { type: 'object', description: '各场景降级配置组 ID 顺序' },
    },
    required: ['scenarioProfiles', 'scenarioMetas'],
  },
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const [state, legacyProfiles] = await Promise.all([
      getAIProfileState(),
      buildLegacyAIProfiles(),
    ]);

    return NextResponse.json(
      successResponse({
        ...state,
        legacyProfiles,
        meta: {
          scenarios: state.scenarioMetas,
          fieldLabels: AI_FIELD_LABELS,
        },
      }),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('获取 AI 配置组失败:', error);
    return NextResponse.json(errorResponse('获取 AI 配置组失败'), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json();
    const state = await saveAIProfileState(body);

    return NextResponse.json(successResponse(state, 'AI 配置组已保存'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('保存 AI 配置组失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '保存 AI 配置组失败'),
      { status: 500 },
    );
  }
}
