/**
 * API Catch-all 路由
 * 捕获所有未定义的 /api/* 路径，防止被博客动态路由捕获
 * 
 * 注意：这个路由优先级低于所有精确匹配的 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  
  console.log('⚠️ [API 404] 未找到的 API 端点:', url.pathname);

  return NextResponse.json({
    error: 'not_found',
    message: 'API endpoint not found',
    path: url.pathname,
    hint: 'Check your API endpoint path'
  }, {
    status: 404,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function PUT(request: NextRequest) {
  return GET(request);
}

export async function DELETE(request: NextRequest) {
  return GET(request);
}

export async function PATCH(request: NextRequest) {
  return GET(request);
}
