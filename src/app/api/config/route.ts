/**
 * 创建配置API
 * POST /api/config
 */

import { NextRequest, NextResponse } from 'next/server';
import { createConfig } from '@/services/config';
import { requirePermission } from '@/lib/permission';
import { CONFIG_EDIT } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const body = await request.json();
    const result = await createConfig(body);

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建配置失败:', error);
    const errorMessage = error instanceof Error ? error.message : '创建配置失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
