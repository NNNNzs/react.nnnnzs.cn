/**
 * 创建博客文章API
 * POST /api/post/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostRepository } from '@/lib/repositories';
import {
  successResponse,
  errorResponse,
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import dayjs from 'dayjs';

export async function POST(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token || !(await validateToken(token))) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const body = await request.json();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const postData = {
      ...body,
      date: now,
      updated: now,
      hide: body.hide || '0',
      is_delete: 0,
      visitors: 0,
      likes: 0,
    };

    const postRepository = await getPostRepository();
    const result = await postRepository.save(postData);

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建文章失败:', error);
    return NextResponse.json(errorResponse('创建文章失败'), { status: 500 });
  }
}
