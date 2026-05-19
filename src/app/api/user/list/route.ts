/**
 * 用户列表API
 * GET /api/user/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserList } from '@/services/user';
import { requirePermission } from '@/lib/permission';
import { USER_VIEW } from '@/constants/permissions';
import type { QueryUserCondition } from '@/dto/user.dto';
import { successResponse, errorResponse } from '@/dto/response.dto';
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageNum = Number(searchParams.get('pageNum')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 10;
    const query = searchParams.get('query') || '';
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status')
      ? Number(searchParams.get('status'))
      : undefined;

    const params: QueryUserCondition = {
      pageNum,
      pageSize,
      query,
      role,
      status,
    };

    const result = await getUserList(params);

    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(errorResponse('获取用户列表失败'), {
      status: 500,
    });
  }
}
