/**
 * API 路由: /api/wechat/getToken
 * 功能: 调用开放平台创建扫码会话，支持登录和绑定两种场景
 */

import { NextRequest, NextResponse } from 'next/server';
import { callOpenPlatformAPI } from '@/lib/open-platform';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * GET /api/wechat/getToken?action=login&userId=123&redirectUrl=/c/dashboard
 * 创建扫码会话
 *
 * 参数：
 * - action: 场景类型，login（登录）或 bind（绑定）
 * - userId: 绑定场景下的用户ID
 * - redirectUrl: 登录成功后跳转地址
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = (searchParams.get('action') || 'login') as 'login' | 'bind';
    const userId = searchParams.get('userId');
    const redirectUrl = searchParams.get('redirectUrl');

    // 构建传递给开放平台的参数
    const params: Record<string, any> = {
      action,
    };

    if (action === 'bind' && userId) {
      params.userId = parseInt(userId, 10);
    }

    if (redirectUrl) {
      params.redirectUrl = redirectUrl;
    }

    // 调用开放平台创建会话
    const data = await callOpenPlatformAPI('/qr/getToken', 'POST', {
      params,
    });

    return NextResponse.json(successResponse(data));
  } catch (error) {
    console.error('获取 token 失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '获取 token 失败'),
      { status: 500 }
    );
  }
}
