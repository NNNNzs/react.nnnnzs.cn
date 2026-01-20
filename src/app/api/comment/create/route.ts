/**
 * 创建评论路由
 * 路由: /api/comment/create
 * 创建评论（存储到数据库）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { createComment, canComment, getMissingBindings } from '@/services/comment';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * POST /api/comment/create
 * 创建评论
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const user = await getUserFromToken(request);

    if (!user) {
      return NextResponse.json(
        errorResponse('未登录或登录已过期'),
        { status: 401 }
      );
    }

    // 检查评论权限
    if (!canComment(user)) {
      const missing = getMissingBindings(user);
      return NextResponse.json(
        errorResponse(`需要绑定以下任一方式才能评论：${missing.join('、')}`),
        { status: 403 }
      );
    }

    // 解析请求参数
    const body = await request.json();
    const { postId, content, parentId } = body;

    if (!postId || !content) {
      return NextResponse.json(
        errorResponse('参数缺失'),
        { status: 400 }
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        errorResponse('评论内容不能为空'),
        { status: 400 }
      );
    }

    // 创建评论
    const comment = await createComment(user.id, {
      postId: Number(postId),
      content: content.trim(),
      parentId: parentId ? Number(parentId) : undefined,
    });

    return NextResponse.json(
      successResponse(comment, '评论成功')
    );
  } catch (error) {
    console.error('创建评论失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建评论失败'),
      { status: 500 }
    );
  }
}
