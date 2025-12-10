/**
 * API 路由: /api/wechat/info
 * 功能: 获取 token 对应的用户信息
 */

import { NextRequest, NextResponse } from 'next/server';
import redisService from '@/lib/redis';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * GET /api/wechat/info?token=xxx
 * 获取扫码登录的用户信息
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        errorResponse('缺少 token 参数'),
        { status: 400 }
      );
    }

    const infoStr = await redisService.get(`wechat_screen_key/${token}`);

    if (!infoStr) {
      return NextResponse.json(
        errorResponse('token 不存在或已过期'),
        { status: 404 }
      );
    }

    const info = JSON.parse(infoStr);

    return NextResponse.json(successResponse(info));
  } catch (error) {
    console.error('获取信息失败:', error);
    return NextResponse.json(
      errorResponse('获取信息失败'),
      { status: 500 }
    );
  }
}
