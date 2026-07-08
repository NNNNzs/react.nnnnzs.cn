/**
 * AI 供应商详情 API
 * PUT    /api/config/ai/providers/[id]    更新供应商
 * DELETE /api/config/ai/providers/[id]    删除供应商（级联删除绑定）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { deleteProvider, getProvider, updateProvider } from '@/services/ai-provider';
import { clearAIConfigCache } from '@/lib/ai-config';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const updateDescriptor: ApiDescriptor = {
  code: 'config_ai_provider_update',
  name: '更新 AI 供应商',
  module: 'config',
  method: 'PUT',
  permissionCode: CONFIG_EDIT,
};

export const deleteDescriptor: ApiDescriptor = {
  code: 'config_ai_provider_delete',
  name: '删除 AI 供应商',
  module: 'config',
  method: 'DELETE',
  permissionCode: CONFIG_EDIT,
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

export async function PUT(
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

    const existing = await getProvider(providerId);
    if (!existing) {
      return NextResponse.json(errorResponse('供应商不存在'), { status: 404 });
    }

    const body = await request.json();
    const updated = await updateProvider(providerId, body);
    clearAIConfigCache();
    return NextResponse.json(successResponse(updated, '供应商已更新'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('更新 AI 供应商失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '更新 AI 供应商失败'),
      { status: 500 },
    );
  }
}

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
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return NextResponse.json(errorResponse('无效的供应商 ID'), { status: 400 });
    }

    await deleteProvider(providerId);
    clearAIConfigCache();
    return NextResponse.json(successResponse(null, '供应商已删除'), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error('删除 AI 供应商失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '删除 AI 供应商失败'),
      { status: 500 },
    );
  }
}
