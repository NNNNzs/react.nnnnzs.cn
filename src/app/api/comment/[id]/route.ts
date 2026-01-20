/**
 * 删除评论路由
 * 路由: /api/comment/[id]
 * 删除评论
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { deleteComment } from '@/services/comment';
import { successResponse, errorResponse } from '@/dto/response.dto';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * DELETE /api/comment/[id]
 * 删除评论（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // 验证用户登录状态
    const user = await getUserFromToken(request);

    if (!user) {
      return NextResponse.json(
        errorResponse('未登录或登录已过期'),
        { status: 401 }
      );
    }

    const { id } = await params;
    const commentId = Number(id);

    if (isNaN(commentId)) {
      return NextResponse.json(
        errorResponse('评论ID无效'),
        { status: 400 }
      );
    }

    // 删除评论
    await deleteComment(commentId, user.id);

    return NextResponse.json(
      successResponse(null, '删除成功')
    );
  } catch (error) {
    console.error('删除评论失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '删除评论失败'),
      { status: 500 }
    );
  }
}
