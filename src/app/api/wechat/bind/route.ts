/**
 * API 路由: /api/wechat/bind
 * 功能: 已登录用户绑定微信 openID
 */

import { NextRequest, NextResponse } from 'next/server';
import redisService from '@/lib/redis';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';

/**
 * POST /api/wechat/bind
 * 绑定微信 openID 到当前登录用户
 * 
 * 请求体:
 * - token: 扫码登录生成的 token（从 Redis 获取 openid）
 */
export async function POST(request: NextRequest) {
  try {
    // 获取当前登录用户
    const currentUser = await getUserFromToken(request);
    
    if (!currentUser) {
      return NextResponse.json(
        errorResponse('请先登录'),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        errorResponse('缺少 token 参数'),
        { status: 400 }
      );
    }

    // 从 Redis 获取扫码信息
    const infoStr = await redisService.get(`wechat_screen_key/${token}`);

    if (!infoStr) {
      return NextResponse.json(
        errorResponse('token 不存在或已过期'),
        { status: 404 }
      );
    }

    const info = JSON.parse(infoStr);
    const { openid } = info;

    if (!openid) {
      return NextResponse.json(
        errorResponse('未获取到微信 openID'),
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // 检查该 openid 是否已被其他用户绑定
    const existingUser = await prisma.tbUser.findFirst({
      where: { 
        wx_open_id: openid,
        id: {
          not: currentUser.id // 排除当前用户
        }
      },
    });

    if (existingUser) {
      return NextResponse.json(
        errorResponse('该微信已被其他账号绑定'),
        { status: 400 }
      );
    }

    // 绑定 openid 到当前用户
    await prisma.tbUser.update({
      where: { id: currentUser.id },
      data: { wx_open_id: openid },
    });

    // 删除 Redis 中的临时数据
    await redisService.del(`wechat_screen_key/${token}`);

    return NextResponse.json(successResponse({ msg: '绑定成功' }));
  } catch (error) {
    console.error('绑定微信失败:', error);
    return NextResponse.json(
      errorResponse('绑定微信失败'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wechat/bind
 * 解绑微信 openID
 */
export async function DELETE(request: NextRequest) {
  try {
    // 获取当前登录用户
    const currentUser = await getUserFromToken(request);
    
    if (!currentUser) {
      return NextResponse.json(
        errorResponse('请先登录'),
        { status: 401 }
      );
    }

    const prisma = await getPrisma();

    // 检查用户是否已绑定微信
    const user = await prisma.tbUser.findUnique({
      where: { id: currentUser.id },
    });

    if (!user || !user.wx_open_id) {
      return NextResponse.json(
        errorResponse('未绑定微信'),
        { status: 400 }
      );
    }

    // 解绑微信
    await prisma.tbUser.update({
      where: { id: currentUser.id },
      data: { wx_open_id: null },
    });

    return NextResponse.json(successResponse({ msg: '解绑成功' }));
  } catch (error) {
    console.error('解绑微信失败:', error);
    return NextResponse.json(
      errorResponse('解绑微信失败'),
      { status: 500 }
    );
  }
}
