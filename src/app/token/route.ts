/**
 * OAuth 2.0 Token Endpoint (根路径)
 * 支持完整的 OAuth 流程：
 * - authorization_code: 授权码换取 Token
 * - client_credentials: 客户端凭据
 * - refresh_token: 刷新 Token
 */

import { NextRequest } from 'next/server';
import { handleOAuthTokenRequest } from '@/services/mcpAuth';

export async function POST(request: NextRequest) {
  // 添加详细的请求日志，帮助调试
  const contentType = request.headers.get('content-type');
  const url = request.url;

  console.log('📥 [Token Endpoint] 收到请求:', {
    url,
    method: 'POST',
    contentType,
    headers: Object.fromEntries(request.headers.entries())
  });

  try {
    const body = await request.clone().json();
    console.log('📋 [Token Endpoint] 请求体:', body);
  } catch {
    // 如果不是 JSON，尝试读取文本
    const text = await request.clone().text();
    console.log('📋 [Token Endpoint] 请求体 (文本):', text);
  }

  // 使用统一的 OAuth Token 处理器
  return handleOAuthTokenRequest(request);
}

export async function GET() {
  const { NextResponse } = await import('next/server');
  return NextResponse.json({
    endpoint: '/token',
    description: 'OAuth 2.0 Token Endpoint',
    method: 'POST',
    supported_grant_types: ['authorization_code', 'client_credentials', 'refresh_token']
  });
}
