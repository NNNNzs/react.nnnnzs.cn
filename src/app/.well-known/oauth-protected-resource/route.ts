/**
 * OAuth 2.0 Protected Resource Metadata
 * 符合 RFC 8707 标准 - 提供完整的 OAuth 元数据
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const resource = `${url.origin}/api/mcp`;

  return NextResponse.json({
    resource,
    authorization_servers: [url.origin],
    scopes_supported: ['read', 'write', 'admin'],
    service_documentation: 'https://github.com/NNNNzs/react.nnnnzs.cn',
    api_version: '1.0.0'
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
