/**
 * 文章向量化状态查询和手动触发 API
 * GET /api/post/[id]/embed - 查询文章向量化状态
 * POST /api/post/[id]/embed - 手动触发文章向量化（强制更新）
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueEmbedPost, getQueueStatus } from '@/services/embedding';
import { getTokenFromRequest, validateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';

/**
 * GET /api/post/[id]/embed
 * 查询文章向量化状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const { id } = await params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json(errorResponse('无效的文章ID'), { status: 400 });
    }

    const prisma = await getPrisma();

    // 查询文章信息
    const post = await prisma.tbPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        rag_status: true,
        rag_error: true,
        rag_updated_at: true,
        created_by: true,
      },
    });

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 获取队列状态
    const queueStatus = getQueueStatus();
    const isInQueue = queueStatus.queueTasks.some(t => t.postId === postId);
    const isProcessing = queueStatus.processingTasks.includes(postId);

    return NextResponse.json(
      successResponse({
        postId: post.id,
        title: post.title,
        ragStatus: post.rag_status || 'pending',
        ragError: post.rag_error,
        ragUpdatedAt: post.rag_updated_at?.toISOString() || null,
        isInQueue,
        isProcessing,
      })
    );
  } catch (error) {
    console.error('查询文章向量化状态失败:', error);
    const errorMessage = error instanceof Error ? error.message : '查询失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}

/**
 * POST /api/post/[id]/embed
 * 手动触发文章向量化（强制更新）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const { id } = await params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json(errorResponse('无效的文章ID'), { status: 400 });
    }

    const prisma = await getPrisma();

    // 查询文章信息
    const post = await prisma.tbPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        content: true,
        hide: true,
        created_by: true,
      },
    });

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 检查权限（只能管理自己创建的文章，管理员除外）
    if (user.role !== 'admin' && post.created_by !== user.id) {
      return NextResponse.json(errorResponse('无权限操作此文章'), { status: 403 });
    }

    // 检查文章内容
    if (!post.content || post.content.trim().length === 0) {
      return NextResponse.json(errorResponse('文章内容为空'), { status: 400 });
    }

    // 添加到向量化队列（高优先级，因为是手动触发）
    await queueEmbedPost({
      postId: post.id,
      title: post.title || '',
      content: post.content,
      hide: post.hide || '0',
      priority: 1, // 手动触发优先级最高
    });

    return NextResponse.json(
      successResponse({
        postId: post.id,
        message: '文章已添加到向量化队列',
      }),
      { status: 202 }
    );
  } catch (error) {
    console.error('触发文章向量化失败:', error);
    const errorMessage = error instanceof Error ? error.message : '触发失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
