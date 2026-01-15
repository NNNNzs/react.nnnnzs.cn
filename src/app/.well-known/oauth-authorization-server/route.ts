/**
 * OAuth 2.0 Authorization Server Metadata
 * 符合 RFC 8414 标准
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  return NextResponse.json({
    issuer: url.origin,
    authorization_endpoint: `${url.origin}/authorize`,
    token_endpoint: `${url.origin}/token`,
    revocation_endpoint: `${url.origin}/revoke`,
    introspection_endpoint: `${url.origin}/introspect`,
    registration_endpoint: `${url.origin}/register`,
    scopes_supported: ['read', 'write', 'admin'],
    response_types_supported: ['token', 'code'],  // ← 声明支持，但实际端点会拒绝
    grant_types_supported: ['client_credentials', 'authorization_code'],  // ← 声明支持
    token_endpoint_auth_methods_supported: ['bearer', 'none'],
    code_challenge_methods_supported: ['plain', 'S256'],  // ← PKCE 支持声明
    service_documentation: 'https://github.com/NNNNzs/react.nnnnzs.cn'
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
