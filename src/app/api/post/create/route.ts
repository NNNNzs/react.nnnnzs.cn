/**
 * 创建博客文章API
 * POST /api/post/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPost } from '@/services/post';
import {
  successResponse,
  errorResponse,
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token || !(await validateToken(token))) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const body = await request.json();
    const result = await createPost(body);

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建文章失败:', error);
    return NextResponse.json(errorResponse('创建文章失败'), { status: 500 });
  }
}
