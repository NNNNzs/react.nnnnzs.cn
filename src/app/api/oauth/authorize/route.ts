/**
 * OAuth 授权处理 API
 * 生成授权码并存储到 Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateMcpRequest } from '@/services/mcpAuth';
import redis from '@/lib/redis';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // 验证用户是否已登录
    const authResult = await authenticateMcpRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        status: false,
        message: '用户未登录',
        data: null
      }, { status: 401 });
    }

    const body = await request.json();
    const {
      client_id,
      redirect_uri,
      response_type,
      state,
      code_challenge,
      code_challenge_method,
      scope = 'read',
      approved,
      duration = 7
    } = body;

    // 验证必需参数
    if (!client_id || !redirect_uri || !response_type) {
      return NextResponse.json({
        status: false,
        message: '缺少必需的 OAuth 参数',
        data: null
      }, { status: 400 });
    }

    // 用户拒绝授权
    if (!approved) {
      return NextResponse.json({
        status: false,
        message: '用户拒绝授权',
        data: null
      }, { status: 403 });
    }

    // 生成授权码
    const authorizationCode = `AUTH_CODE_${crypto.randomBytes(32).toString('hex')}`;

    // 存储授权码信息到 Redis（10分钟有效期）
    const authCodeData = {
      code: authorizationCode,
      client_id,
      redirect_uri,
      user_id: authResult.user.id,
      scope,
      code_challenge,
      code_challenge_method,
      created_at: Date.now(),
      duration: duration,
      app_name: body.app_name || null // 自定义应用名称
    };

    await redis.setex(
      `oauth:auth_code:${authorizationCode}`,
      600, // 10分钟
      JSON.stringify(authCodeData)
    );

    console.log('✅ [OAuth] 授权码已生成:', {
      client_id,
      user_id: authResult.user.id,
      code: authorizationCode.substring(0, 20) + '...'
    });

    return NextResponse.json({
      status: true,
      message: '授权成功',
      data: {
        code: authorizationCode,
        state
      }
    });
  } catch (error) {
    console.error('❌ [OAuth Authorize] 错误:', error);
    return NextResponse.json({
      status: false,
      message: error instanceof Error ? error.message : '授权失败',
      data: null
    }, { status: 500 });
  }
}
