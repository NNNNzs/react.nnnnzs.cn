/**
 * API 路由: /api/wechat/code2Session
 * 功能: 微信小程序通过 code 换取 openid 和 session_key
 */

import { NextRequest, NextResponse } from 'next/server';
import { wechat } from '@/lib/wechat';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * GET /api/wechat/code2Session?code=xxx
 * 通过微信登录凭证 code 获取 openid 和 session_key
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        errorResponse('缺少 code 参数'),
        { status: 400 }
      );
    }

    // 调用微信接口获取 openid
    const result = await wechat.code2Session(code);

    // 检查是否有错误
    if (result.errcode) {
      console.error('微信 code2session 失败:', result);
      return NextResponse.json(
        errorResponse(result.errmsg || '获取 openid 失败'),
        { status: 400 }
      );
    }

    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('code2Session 失败:', error);
    return NextResponse.json(
      errorResponse('code2Session 失败'),
      { status: 500 }
    );
  }
}
