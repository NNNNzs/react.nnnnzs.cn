/**
 * 用户列表API
 * GET /api/user/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserList } from '@/services/user';
import {
  successResponse,
  errorResponse,
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { isAdmin } from '@/types/role';
import type { QueryUserCondition } from '@/dto/user.dto';

export async function GET(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const user = await validateToken(token);
    if (!user) {
      return NextResponse.json(errorResponse('登录已过期'), { status: 401 });
    }

    // 检查是否是管理员
    if (!isAdmin(user.role)) {
      return NextResponse.json(errorResponse('无权限访问'), { status: 403 });
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
