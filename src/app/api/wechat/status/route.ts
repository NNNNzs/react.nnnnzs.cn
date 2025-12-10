/**
 * API 路由: /api/wechat/status
 * 功能: 获取或更新 token 的状态
 */

import { NextRequest, NextResponse } from 'next/server';
import redisService from '@/lib/redis';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * GET /api/wechat/status?token=xxx
 * 获取扫码状态
 * 返回: -1 未扫码, 0 已扫码未授权, 1 已授权
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

    return NextResponse.json(successResponse(info.status));
  } catch (error) {
    console.error('获取状态失败:', error);
    return NextResponse.json(
      errorResponse('获取状态失败'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wechat/status?token=xxx
 * 更新扫码状态
 */
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const body = await request.json();
    const { status } = body;

    if (!token) {
      return NextResponse.json(
        errorResponse('缺少 token 参数'),
        { status: 400 }
      );
    }

    if (status === undefined) {
      return NextResponse.json(
        errorResponse('缺少 status 参数'),
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
    info.status = status;

    await redisService.set(
      `wechat_screen_key/${token}`,
      JSON.stringify(info),
      'EX',
      3600
    );

    return NextResponse.json(successResponse(null));
  } catch (error) {
    console.error('更新状态失败:', error);
    return NextResponse.json(
      errorResponse('更新状态失败'),
      { status: 500 }
    );
  }
}
