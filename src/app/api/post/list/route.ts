/**
 * 博客文章列表API
 * GET /api/post/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostList } from '@/services/post';
import { successResponse, errorResponse } from '@/lib/auth';
import type { QueryCondition } from '@/dto/post.dto';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageNum = Number(searchParams.get('pageNum')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 10;
    const hide = searchParams.get('hide') || '0';
    const query = searchParams.get('query') || '';

    const params: QueryCondition = {
      pageNum,
      pageSize,
      hide,
      query,
    };

    const result = await getPostList(params);

    return NextResponse.json(
      successResponse(result)
    );
  } catch (error) {
    console.error('获取文章列表失败:', error);
    return NextResponse.json(errorResponse('获取文章列表失败'), {
      status: 500,
    });
  }
}
