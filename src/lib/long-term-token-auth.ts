/**
 * 长期Token认证中间件和工具函数
 * 用于支持长期Token的API认证
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, validateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * 从请求中获取用户ID（支持普通Token和长期Token）
 */
export async function getUserIdFromRequest(
  headers: Headers | Record<string, string | string[] | undefined>
): Promise<string | null> {
  const token = getTokenFromRequest(headers);
  if (!token) return null;

  const user = await validateToken(token);
  return user?.id.toString() || null;
}

/**
 * 认证中间件 - 包装API处理函数，自动处理认证
 */
export function withAuth(handler: (userId: string, request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const userId = await getUserIdFromRequest(request.headers);

      if (!userId) {
        return NextResponse.json(
          errorResponse('未登录或Token无效'),
          { status: 401 }
        );
      }

      return await handler(userId, request);
    } catch (error) {
      console.error('认证处理失败:', error);
      const errorMessage = error instanceof Error ? error.message : '处理失败';
      return NextResponse.json(errorResponse(errorMessage), { status: 500 });
    }
  };
}

/**
 * 验证请求的认证信息并返回用户信息
 */
export async function authenticateRequest(
  headers: Headers | Record<string, string | string[] | undefined>
): Promise<{ userId: string; tokenType: 'regular' | 'long-term' } | null> {
  const token = getTokenFromRequest(headers);
  if (!token) return null;

  const tokenType = token.startsWith('LTK_') ? 'long-term' : 'regular';
  const user = await validateToken(token);
  if (user) {
    return { userId: user.id.toString(), tokenType };
  }

  return null;
}

/**
 * 创建认证成功的响应
 */
export function createAuthSuccessResponse(
  userId: string,
  tokenType: 'regular' | 'long-term',
  data?: unknown
) {
  return successResponse({
    userId,
    tokenType,
    data,
  });
}