/**
 * Catch-all 路由：处理 .well-known 下的所有未定义子路径
 * 防止被博客动态路由捕获
 * 
 * 识别并明确拒绝常见的错误路径模式：
 * - /.well-known/{valid_path}/api/mcp - 错误的路径拼接
 * - /.well-known/{valid_path}/* - 不存在的子路径
 */

import { NextRequest, NextResponse } from 'next/server';

// 有效的 .well-known 端点列表
const VALID_ENDPOINTS = [
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server',
  '/.well-known/openid-configuration'
];

// 常见的错误路径模式
const ERROR_PATTERNS = [
  /^\/\.well-known\/[^/]+\/api\/mcp$/,
  /^\/\.well-known\/[^/]+\/api\//,
  /^\/\.well-known\/[^/]+\/[^/]+\//
];

/**
 * 检测是否为已知的错误路径模式
 */
function detectErrorPattern(pathname: string): string | null {
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(pathname)) {
      if (pathname.includes('/api/mcp')) {
        return 'path_concatenation_error';
      }
      return 'invalid_subpath';
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 检测错误模式
  const errorType = detectErrorPattern(pathname);
  
  if (errorType) {
    console.log(`⚠️ [.well-known catch-all] 拦截错误路径模式 (${errorType}):`, pathname);
    
    // 提供更详细的错误信息和正确的端点位置
    const baseUrl = url.origin;
    const correctEndpoints = VALID_ENDPOINTS.map(endpoint => `${baseUrl}${endpoint}`);
    
    return NextResponse.json({
      error: 'not_found',
      error_type: errorType,
      message: errorType === 'path_concatenation_error' 
        ? 'Invalid path concatenation. The .well-known endpoint should not be combined with /api/mcp'
        : 'The requested .well-known endpoint does not exist',
      path: pathname,
      valid_endpoints: VALID_ENDPOINTS,
      correct_endpoints: correctEndpoints,
      hint: errorType === 'path_concatenation_error'
        ? `Use ${baseUrl}/.well-known/oauth-protected-resource to discover endpoints, then use ${baseUrl}/api/mcp separately. The MCP endpoint is at ${baseUrl}/api/mcp, not under .well-known.`
        : 'Check the valid_endpoints list for available endpoints',
      mcp_endpoint: `${baseUrl}/api/mcp`,
      revoke_endpoint: `${baseUrl}/revoke`
    }, {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
  
  // 通用未知路径处理
  console.log('⚠️ [.well-known catch-all] 拦截未知子路径:', pathname);
  
  return NextResponse.json({
    error: 'not_found',
    message: 'The requested .well-known endpoint does not exist',
    path: pathname,
    valid_endpoints: VALID_ENDPOINTS
  }, {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
