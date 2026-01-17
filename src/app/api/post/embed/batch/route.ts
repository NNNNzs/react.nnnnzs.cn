/**
 * 批量更新文章向量 API
 * POST /api/post/embed/batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { queueEmbedPosts, getQueueStatus, embeddingQueue } from '@/services/embedding';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';

/**
 * 批量更新文章向量接口（使用异步队列）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const body = await request.json();
    const { postIds } = body;

    const prisma = await getPrisma();

    // 确定要更新的文章ID列表
    let targetPostIds: number[] = [];

    if (postIds && Array.isArray(postIds) && postIds.length > 0) {
      // 更新指定的文章
      targetPostIds = postIds.map((id: unknown) => Number(id));
    } else {
      // 更新所有未删除的文章
      const posts = await prisma.tbPost.findMany({
        where: {
          is_delete: 0,
        },
        select: {
          id: true,
        },
      });
      targetPostIds = posts.map(p => p.id);
    }

    if (targetPostIds.length === 0) {
      return NextResponse.json(
        successResponse(
          {
            total: 0,
            queued: 0,
            queueStatus: getQueueStatus(),
          },
          '没有需要更新的文章'
        )
      );
    }

    // 批量添加到向量化队列
    await queueEmbedPosts(targetPostIds);

    // 确保队列已启动
    embeddingQueue.start();

    return NextResponse.json(
      successResponse(
        {
          total: targetPostIds.length,
          queued: targetPostIds.length,
          queueStatus: getQueueStatus(),
        },
        `已将 ${targetPostIds.length} 篇文章添加到向量化队列`
      )
    );
  } catch (error) {
    console.error('批量更新文章向量失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '批量更新文章向量失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
