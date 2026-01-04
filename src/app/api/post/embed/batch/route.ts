/**
 * 批量更新文章向量 API
 * POST /api/post/embed/batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedPost } from '@/services/embedding';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';

/**
 * 批量更新文章向量接口
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
    const { postIds, force = false } = body;

    // 如果指定了 postIds，只更新这些文章；否则更新所有文章
    const prisma = await getPrisma();
    
    let posts;
    if (postIds && Array.isArray(postIds) && postIds.length > 0) {
      // 更新指定的文章
      posts = await prisma.tbPost.findMany({
        where: {
          id: { in: postIds.map((id: unknown) => Number(id)) },
          is_delete: 0,
        },
        select: {
          id: true,
          title: true,
          content: true,
        },
      });
    } else {
      // 更新所有未删除的文章
      posts = await prisma.tbPost.findMany({
        where: {
          is_delete: 0,
        },
        select: {
          id: true,
          title: true,
          content: true,
        },
        orderBy: {
          id: 'asc',
        },
      });
    }

    if (posts.length === 0) {
      return NextResponse.json(
        successResponse(
          { total: 0, success: 0, failed: 0, skipped: 0, results: [] },
          '没有需要更新的文章'
        )
      );
    }

    // 批量处理文章向量化
    const results: Array<{
      postId: number;
      success: boolean;
      message: string;
      insertedCount?: number;
      chunkCount?: number;
      skipped?: boolean;
    }> = [];

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // 逐个处理文章（避免并发过多导致 API 限流）
    for (const post of posts) {
      try {
        if (!post.content || post.content.trim().length === 0) {
          results.push({
            postId: post.id,
            success: false,
            message: '文章内容为空，跳过',
          });
          failedCount++;
          continue;
        }

        const result = await embedPost({
          postId: post.id,
          title: post.title || '无标题',
          content: post.content,
          force: Boolean(force),
        });

        // 检查是否因为已存在向量而跳过
        if (result.skipped) {
          results.push({
            postId: post.id,
            success: true,
            message: '已存在向量数据，跳过（使用 force=true 可强制更新）',
            insertedCount: 0,
            chunkCount: 0,
            skipped: true,
          });
          skippedCount++;
        } else {
          results.push({
            postId: post.id,
            success: true,
            message: '向量化成功',
            insertedCount: result.insertedCount,
            chunkCount: result.chunkCount,
          });
          successCount++;
        }
      } catch (error) {
        console.error(`文章 ${post.id} 向量化失败:`, error);
        results.push({
          postId: post.id,
          success: false,
          message:
            error instanceof Error ? error.message : '向量化失败',
        });
        failedCount++;
      }
    }

    return NextResponse.json(
      successResponse(
        {
          total: posts.length,
          success: successCount,
          failed: failedCount,
          skipped: skippedCount,
          results: results,
        },
        `批量更新完成：成功 ${successCount} 篇，跳过 ${skippedCount} 篇，失败 ${failedCount} 篇`
      )
    );
  } catch (error) {
    console.error('批量更新文章向量失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '批量更新文章向量失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
