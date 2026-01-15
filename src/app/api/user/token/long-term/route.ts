/**
 * 长期Token管理API
 * POST /api/user/token/long-term - 创建长期Token
 * GET /api/user/token/long-term - 获取用户长期Token列表
 * DELETE /api/user/token/long-term - 删除长期Token
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import {
  createLongTermToken,
  getUserLongTermTokens,
  deleteLongTermToken,
} from '@/services/token';
import type { LongTermTokenDto } from '@/dto/user.dto';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * 创建长期Token
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
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

    // 解析请求体
    const body: LongTermTokenDto = await request.json();
    const { duration, description } = body;

    // 验证参数 - 注意处理0值的情况
    if (duration === undefined || duration === null) {
      return NextResponse.json(
        errorResponse('有效期参数必填'),
        { status: 400 }
      );
    }

    // 使用严格相等检查，确保0值能通过验证
    if (
![7, 30, 0].includes(Number(duration))
) {
      return NextResponse.json(
        errorResponse('有效期只能是7、30或0(永久)'),
        { status: 400 }
      );
    }

    // 创建长期Token
    const tokenRecord = await createLongTermToken(
      user.id.toString(),
      duration,
      description || `长期Token - ${duration === 0 ? '永久' : `${duration}天`}`
    );

    return NextResponse.json(
      successResponse(tokenRecord, 'Token生成成功')
    );
  } catch (error) {
    console.error('创建长期Token失败:', error);
    const errorMessage = error instanceof Error ? error.message : '创建长期Token失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}

/**
 * 获取用户长期Token列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
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

    // 获取用户的长期Token列表
    const tokens = await getUserLongTermTokens(user.id.toString());

    return NextResponse.json(
      successResponse(tokens, '获取成功')
    );
  } catch (error) {
    console.error('获取长期Token列表失败:', error);
    const errorMessage = error instanceof Error ? error.message : '获取长期Token列表失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}

/**
 * 删除长期Token
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户身份
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

    // 获取要删除的token ID
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('id');

    if (!tokenId) {
      return NextResponse.json(
        errorResponse('Token ID必填'),
        { status: 400 }
      );
    }

    // 删除Token
    const success = await deleteLongTermToken(tokenId, user.id.toString());

    if (!success) {
      return NextResponse.json(
        errorResponse('Token不存在或无权删除'),
        { status: 403 }
      );
    }

    return NextResponse.json(
      successResponse(null, '删除成功')
    );
  } catch (error) {
    console.error('删除长期Token失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除长期Token失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}