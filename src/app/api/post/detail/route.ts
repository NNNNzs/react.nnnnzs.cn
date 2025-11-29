/**
 * 博客文章详情 API
 * GET /api/post/detail?path=/2024/12/25/my-post
 * 或 GET /api/post/detail?id=123
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostByPath, getPostById } from '@/services/post';
import { successResponse, errorResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');
    const idParam = searchParams.get('id');

    if (!path && !idParam) {
      return NextResponse.json(errorResponse('缺少参数 path 或 id'), { status: 400 });
    }

    let post = null;

    if (path) {
      post = await getPostByPath(path);
    } else if (idParam) {
      post = await getPostById(Number(idParam));
    }

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(post));
  } catch (error) {
    console.error('获取文章详情失败:', error);
    return NextResponse.json(errorResponse('获取文章详情失败'), { status: 500 });
  }
}
