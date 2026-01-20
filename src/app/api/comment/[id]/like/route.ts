/**
 * 点赞评论路由
 * 路由: /api/comment/[id]/like
 * 点赞评论
 */

import { NextRequest, NextResponse } from 'next/server';
import { likeComment } from '@/services/comment';
import { successResponse, errorResponse } from '@/dto/response.dto';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/comment/[id]/like
 * 点赞评论
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const commentId = Number(id);

    if (isNaN(commentId)) {
      return NextResponse.json(
        errorResponse('评论ID无效'),
        { status: 400 }
      );
    }

    // 点赞评论
    await likeComment(commentId);

    return NextResponse.json(
      successResponse(null, '点赞成功')
    );
  } catch (error) {
    console.error('点赞评论失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '点赞评论失败'),
      { status: 500 }
    );
  }
}
