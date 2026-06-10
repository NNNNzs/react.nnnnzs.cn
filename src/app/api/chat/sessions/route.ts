/**
 * 会话列表 API
 * GET  /api/chat/sessions — 获取当前用户的会话列表
 * POST /api/chat/sessions — 创建新会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getSessions, createSession } from '@/services/chat-log';

/**
 * 从请求中获取客户端 IP
 */
function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || undefined;
}

/**
 * 获取当前用户的会话列表
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    const deviceId = user ? undefined : request.headers.get('X-Device-Id') || undefined;

    // 无用户信息也无设备ID，返回空列表
    if (!user && !deviceId) {
      return NextResponse.json(successResponse({ record: [], total: 0 }));
    }

    const { searchParams } = new URL(request.url);
    const pageNum = parseInt(searchParams.get('pageNum') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const result = await getSessions({
      userId: user?.id,
      deviceId,
      pageNum,
      pageSize: Math.min(pageSize, 50),
    });

    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('Get chat sessions error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '获取会话列表失败'),
      { status: 500 },
    );
  }
}

/**
 * 创建新会话
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    const deviceId = user ? undefined : request.headers.get('X-Device-Id') || undefined;
    const ipAddress = getClientIp(request);
    const body = await request.json();
    const { title } = body as { title?: string };

    const session = await createSession({
      userId: user?.id,
      deviceId,
      title: title || undefined,
      ipAddress: ipAddress || undefined,
      userAgent: request.headers.get('User-Agent') || undefined,
    });

    return NextResponse.json(successResponse(session));
  } catch (error) {
    console.error('Create chat session error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建会话失败'),
      { status: 500 },
    );
  }
}
