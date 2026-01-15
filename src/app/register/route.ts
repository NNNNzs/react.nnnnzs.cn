/**
 * OAuth 2.0 Client Registration (根路径)
 * 支持匿名注册，返回手动配置指引
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const { client_name = 'MCP Client' } = body;

    console.log('📝 [OAuth Register] 客户端注册请求:', client_name);

    // 返回模拟的客户端注册响应
    // 提供指引让用户手动获取 Token
    return NextResponse.json({
      client_id: `mcp-client-${Date.now()}`,
      client_secret: 'not-required-use-bearer-token',
      client_name: client_name,
      redirect_uris: [],
      grant_types: ['client_credentials'],
      response_types: ['token'],
      token_endpoint_auth_method: 'none',
      
      // 手动配置说明
      _manual_setup_required: true,
      _instructions: {
        step1: 'Login to get Bearer Token',
        step2: `Visit ${url.origin}/c/user/info to generate long-term token`,
        step3: `Configure: claude mcp add MyBlog ${url.origin}/api/mcp --header "Authorization: Bearer YOUR_TOKEN"`,
        documentation: `${url.origin}/.well-known/oauth-authorization-server`
      }
    }, {
      status: 200,  // 返回 200 避免 Claude CLI 报错
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
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
