/**
 * 删除评论路由
 * 路由: /api/comment/[id]
 * 删除评论
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { deleteComment } from '@/services/comment';
import { getPrisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { isAdmin } from '@/types/role';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * DELETE /api/comment/[id]
 * 删除评论（软删除）
 * 支持两种模式：
 * 1. 普通用户：只能删除自己的评论
 * 2. 管理员：可以删除任意评论
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

    // 管理员可以直接删除，不需要验证所有权
    if (isAdmin(user.role)) {
      const prisma = await getPrisma();

      // 检查评论是否存在
      const comment = await prisma.tbComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return NextResponse.json(
          errorResponse('评论不存在'),
          { status: 404 }
        );
      }

      // 管理员直接软删除
      await prisma.tbComment.update({
        where: { id: commentId },
        data: { is_delete: 1 },
      });

      return NextResponse.json(
        successResponse(null, '删除成功')
      );
    }

    // 普通用户使用原有的删除逻辑（验证所有权）
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
