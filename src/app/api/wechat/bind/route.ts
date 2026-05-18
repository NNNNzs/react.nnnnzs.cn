/**
 * 微信绑定/解绑路由
 * 路由: /api/wechat/bind
 * 功能: 处理微信账号的绑定确认和解绑操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getUserFromToken, storeToken } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/dto/response.dto';
import redisService from '@/lib/redis';

/**
 * POST /api/wechat/bind
 * 确认微信绑定（扫码后确认绑定结果）
 *
 * 请求体: { token: string }
 * 流程：
 * 1. 验证用户登录状态
 * 2. 从 Redis 查询扫码结果
 * 3. 确认绑定状态
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const user = await getUserFromToken(request);

    if (!user) {
      return NextResponse.json(
        errorResponse('未登录或登录已过期'),
        { status: 401 }
      );
    }

    const body = await request.json() as { token: string };
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        errorResponse('缺少 token 参数'),
        { status: 400 }
      );
    }

    // 从 Redis 查询扫码结果
    const redisKey = `wechat_screen_key/${token}`;
    const scanResult = await redisService.get(redisKey);

    if (!scanResult) {
      return NextResponse.json(
        errorResponse('扫码已过期或不存在'),
        { status: 404 }
      );
    }

    const result = JSON.parse(scanResult);

    // 检查是否是绑定操作且状态成功
    if (result.action !== 'bind' || result.status !== 1) {
      return NextResponse.json(
        errorResponse(result.message || '绑定失败'),
        { status: 400 }
      );
    }

    // 获取最新用户信息
    const prisma = await getPrisma();
    const updatedUser = await prisma.tbUser.findUnique({
      where: { id: user.id },
    });

    if (!updatedUser) {
      return NextResponse.json(
        errorResponse('用户不存在'),
        { status: 404 }
      );
    }

    // 更新当前 token 在 Redis 中的用户信息
    const currentToken = getTokenFromRequest(request.headers);
    if (currentToken) {
      await storeToken(currentToken, updatedUser as never);
    }

    // 清除 Redis 中的扫码结果
    await redisService.del(redisKey);

    return NextResponse.json(
      successResponse(
        {
          id: updatedUser.id,
          account: updatedUser.account,
          nickname: updatedUser.nickname,
          wx_open_id: updatedUser.wx_open_id,
          avatar: updatedUser.avatar,
        },
        '绑定成功'
      )
    );
  } catch (error) {
    console.error('微信绑定确认失败:', error);
    return NextResponse.json(
      errorResponse('绑定确认失败'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wechat/bind
 * 解除微信账号绑定
 *
 * 流程：
 * 1. 验证用户登录状态
 * 2. 清除用户的 wx_open_id
 * 3. 更新 Redis 缓存
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户登录状态
    const user = await getUserFromToken(request);

    if (!user) {
      return NextResponse.json(
        errorResponse('未登录或登录已过期'),
        { status: 401 }
      );
    }

    const prisma = await getPrisma();

    // 解绑微信账号
    const updatedUser = await prisma.tbUser.update({
      where: { id: user.id },
      data: {
        wx_open_id: null,
      },
    });

    // 更新当前 token 在 Redis 中的用户信息
    const token = getTokenFromRequest(request.headers);
    if (token) {
      await storeToken(token, updatedUser as never);
    }

    return NextResponse.json(
      successResponse(
        {
          id: updatedUser.id,
          account: updatedUser.account,
          nickname: updatedUser.nickname,
          wx_open_id: updatedUser.wx_open_id,
        },
        '解绑成功'
      )
    );
  } catch (error) {
    console.error('微信解绑失败:', error);
    return NextResponse.json(
      errorResponse('解绑失败'),
      { status: 500 }
    );
  }
}
