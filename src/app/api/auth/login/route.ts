/**
 * OAuth 2.0 Login 端点
 * 用于用户登录并获取访问令牌
 */

import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/services/auth';

/**
 * POST - 用户登录
 * 成功后返回访问令牌
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password } = body;

    if (!account || !password) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'account and password are required'
        },
        { status: 400 }
      );
    }

    const result = await login(account, password);

    if (!result) {
      return NextResponse.json(
        {
          error: 'invalid_credentials',
          error_description: 'Invalid account or password'
        },
        { status: 401 }
      );
    }

    // 返回标准的 OAuth 2.0 令牌响应
    return NextResponse.json(
      {
        token: result.token,
        token_type: 'Bearer',
        expires_in: 7 * 24 * 60 * 60, // 7天
        scope: 'read write',
        user_info: {
          id: result.userInfo.id,
          account: result.userInfo.account,
          role: result.userInfo.role,
          nickname: result.userInfo.nickname
        }
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 登录端点信息
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/auth/login',
    description: 'User Login Endpoint',
    method: 'POST',
    content_type: 'application/json',
    example: {
      request: {
        account: 'admin',
        password: 'your-password'
      },
      response: {
        token: 'YOUR_TOKEN',
        token_type: 'Bearer',
        expires_in: 604800,
        scope: 'read write',
        user_info: {
          id: 1,
          account: 'admin',
          role: 'admin',
          nickname: '管理员'
        }
      }
    }
  });
}
