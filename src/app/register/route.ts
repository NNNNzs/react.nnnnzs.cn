/**
 * OAuth 2.0 Client Registration (根路径)
 * 支持 OAuth 2.0 授权码流程
 * 返回客户端配置，触发完整的授权流程
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const {
      client_name = 'MCP Client',
      redirect_uris = [],
      grant_types = ['authorization_code'],
      response_types = ['code']
    } = body;

    console.log('📝 [OAuth Register] 客户端注册请求:', {
      client_name,
      redirect_uris,
      grant_types,
      response_types
    });

    // 生成唯一的 client_id
    const client_id = `mcp-client-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    // 如果没有提供 redirect_uris，使用默认的 OAuth 2.0 loopback
    const defaultRedirectUris = redirect_uris.length > 0
      ? redirect_uris
      : [
          'http://localhost:4200/callback',  // Cursor 默认端口
          'http://localhost:4200/',
          'http://127.0.0.1:4200/callback',
          'http://127.0.0.1:4200/',
        ];

    // 返回标准 OAuth 2.0 客户端注册响应
    return NextResponse.json({
      client_id,
      // 使用空字符串代替 null，避免某些客户端解析失败
      // 实际认证应该使用 PKCE，不使用这个 secret
      client_secret: '',  // 公共客户端，使用 PKCE，不需要 secret
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,  // 0 表示永不过期
      client_name,
      redirect_uris: defaultRedirectUris,
      grant_types: ['authorization_code', 'client_credentials'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',  // 使用 PKCE，不需要 client secret

      // 授权端点配置
      authorization_endpoint: `${url.origin}/authorize`,
      token_endpoint: `${url.origin}/token`,

      // 支持的 PKCE 方法
      code_challenge_methods_supported: ['S256', 'plain'],

      // 额外的元数据
      software_id: crypto.randomUUID(),
      software_version: '1.0.0',
    }, {
      status: 201,  // 201 Created
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('❌ [OAuth Register] 注册错误:', error);
    return NextResponse.json({
      error: 'invalid_request',
      error_description: error instanceof Error ? error.message : 'Invalid request'
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/register',
    description: 'OAuth 2.0 Client Registration Endpoint',
    method: 'POST',
    note: 'Returns configuration instructions for manual setup'
  });
}
