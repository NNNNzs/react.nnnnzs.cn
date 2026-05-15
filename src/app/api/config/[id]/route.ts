/**
 * 配置详情、更新、删除API
 * GET /api/config/[id]
 * PUT /api/config/[id]
 * DELETE /api/config/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigById, updateConfig, deleteConfig } from '@/services/config';
import { requirePermission } from '@/lib/permission';
import { CONFIG_VIEW, CONFIG_EDIT } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';


/**
 * 获取配置详情
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await context.params;

    const config = await getConfigById(Number(id));

    if (!config) {
      return NextResponse.json(errorResponse('配置不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(config));
  } catch (error) {
    console.error('获取配置详情失败:', error);
    return NextResponse.json(errorResponse('获取配置详情失败'), {
      status: 500,
    });
  }
}

/**
 * 更新配置
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await context.params;
    const body = await request.json();

    const result = await updateConfig(Number(id), body);

    return NextResponse.json(successResponse(result, '更新成功'));
  } catch (error) {
    console.error('更新配置失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新配置失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}

/**
 * 删除配置
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await context.params;

    await deleteConfig(Number(id));

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除配置失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除配置失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
