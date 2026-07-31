/**
 * 博客文章详情 API
 * GET /api/post/detail?path=/2024/12/25/my-post
 * 或 GET /api/post/detail?id=123
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostByPath, getPostById } from '@/services/post';
import { getAuthUserFromRequest } from '@/lib/auth';
import { canViewPost } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';

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
      if (!Number.isInteger(Number(idParam)) || Number(idParam) <= 0) {
        return NextResponse.json(errorResponse('无效的文章 ID'), { status: 400 });
      }
      post = await getPostById(Number(idParam));
    }

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    const user = await getAuthUserFromRequest(request.headers);
    if (!canViewPost(user, post)) {
      return NextResponse.json(errorResponse('无权限查看此隐藏文章'), { status: 403 });
    }

    return NextResponse.json(successResponse(post), {
      headers: post.hide === '1'
        ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
        : undefined,
    });
  } catch (error) {
    console.error('获取文章详情失败:', error);
    return NextResponse.json(errorResponse('获取文章详情失败'), { status: 500 });
  }
}
