/**
 * 获取和更新用户信息API
 * GET /api/user/info - 获取当前用户信息
 * PUT /api/user/info - 更新当前用户信息
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { updateUser } from '@/services/user';
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

    return NextResponse.json(successResponse(user));
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

    // 用户只能更新自己的信息，不能更新 role 和 status
    const updateData: UpdateUserDto = {
      nickname: body.nickname,
      mail: body.mail,
      phone: body.phone,
      avatar: body.avatar,
      password: body.password,
    };

    // 移除 undefined 字段
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof UpdateUserDto] === undefined) {
        delete updateData[key as keyof UpdateUserDto];
      }
    });

    const result = await updateUser(user.id, updateData);

    return NextResponse.json(successResponse(result, '更新成功'));
  } catch (error) {
    console.error('更新用户信息失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新用户信息失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}

