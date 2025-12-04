/**
 * 配置详情、更新、删除API
 * GET /api/config/[id]
 * PUT /api/config/[id]
 * DELETE /api/config/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigById, updateConfig, deleteConfig } from '@/services/config';
import {
  successResponse,
  errorResponse,
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';

/**
 * 获取配置详情
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token || !(await validateToken(token))) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

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
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token || !(await validateToken(token))) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const { id } = await context.params;

    await deleteConfig(Number(id));

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除配置失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除配置失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
