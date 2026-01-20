/**
 * 评论列表路由
 * 路由: /api/comment/list?postId=xxx
 * 获取指定文章的评论列表（从数据库，树形结构）
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCommentList } from '@/services/comment';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * GET /api/comment/list?postId=xxx
 * 获取指定文章的评论列表（树形结构）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        errorResponse('缺少文章ID参数'),
        { status: 400 }
      );
    }

    const postIdNum = Number(postId);

    if (isNaN(postIdNum)) {
      return NextResponse.json(
        errorResponse('文章ID无效'),
        { status: 400 }
      );
    }

    const result = await getCommentList(postIdNum);

    return NextResponse.json(
      successResponse(result)
    );
  } catch (error) {
    console.error('获取评论失败:', error);
    return NextResponse.json(
      errorResponse('获取评论失败'),
      { status: 500 }
    );
  }
}
