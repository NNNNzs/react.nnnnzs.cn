/**
 * 获取和更新用户信息API
 * GET /api/user/info - 获取当前用户信息
 * PUT /api/user/info - 更新当前用户信息
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  setAuthCookie,
  validateToken,
} from '@/lib/auth';
import { getUserById, getUserSecurityState, updateUserProfile } from '@/services/user';
import type { UpdateUserDto } from '@/dto/user.dto';
import { successResponse, errorResponse } from '@/dto/response.dto';
/**
 * 获取当前用户信息
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request.headers);

    if (!token) {
      return NextResponse.json(
        errorResponse('未登录'),
        { status: 401 }
      );
    }

    const user = await validateToken(token);

    if (!user) {
      return NextResponse.json(
        errorResponse('Token无效或已过期'),
        { status: 401 }
      );
    }

    const currentUser = await getUserById(user.id);
    if (!currentUser) {
      return NextResponse.json(errorResponse('用户不存在'), { status: 404 });
    }

    const security = await getUserSecurityState(user.id);
    const response = NextResponse.json(successResponse({
      ...currentUser,
      has_password: Boolean(security?.password),
    }), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      errorResponse('获取用户信息失败'),
      { status: 500 }
    );
  }
}

/**
 * 更新当前用户信息
 */
export async function PUT(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request.headers);

    if (!token) {
      return NextResponse.json(
        errorResponse('未登录'),
        { status: 401 }
      );
    }

    const user = await validateToken(token);

    if (!user) {
      return NextResponse.json(
        errorResponse('Token无效或已过期'),
        { status: 401 }
      );
    }

    const body: UpdateUserDto = await request.json();

    // 邮箱和密码使用专用安全接口，资料接口只接受非敏感字段。
    const updateData: Pick<UpdateUserDto, 'nickname' | 'phone' | 'avatar'> = {
      nickname: body.nickname,
      phone: body.phone,
      avatar: body.avatar,
    };

    // 移除 undefined 字段
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    const result = await updateUserProfile(user.id, updateData);

    return NextResponse.json(successResponse(result, '更新成功'), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新用户信息失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
