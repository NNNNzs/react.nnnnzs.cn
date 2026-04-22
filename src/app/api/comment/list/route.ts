/**
 * 评论列表路由
 * 路由: /api/comment/list
 * 支持两种模式：
 * 1. 前台模式: ?postId=xxx 获取指定文章的评论列表（树形结构）
 * 2. 后台模式: ?pageNum=1&pageSize=20 获取所有评论的分页列表（平铺）
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCommentList } from '@/services/comment';
import { getPrisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { isAdmin } from '@/types/role';

/**
 * GET /api/comment/list
 * 获取评论列表（支持前台和后台两种模式）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const pageNum = searchParams.get('pageNum');
    const pageSize = searchParams.get('pageSize');
    const query = searchParams.get('query');
    const status = searchParams.get('status');

    // 前台模式：获取指定文章的评论（树形结构）
    if (postId && !pageNum) {
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
    }

    // 后台模式：获取所有评论的分页列表（需要管理员权限）
    const user = await getUserFromToken(request);

    if (!user) {
      return NextResponse.json(
        errorResponse('未登录或登录已过期'),
        { status: 401 }
      );
    }

    if (!isAdmin(user.role)) {
      return NextResponse.json(
        errorResponse('无权限访问'),
        { status: 403 }
      );
    }

    const prisma = await getPrisma();

    // 构建查询条件
    const where: Record<string, unknown> = {
      is_delete: 0,
    };

    if (query) {
      where.content = {
        contains: query,
      };
    }

    if (status !== null && status !== undefined && status !== '') {
      where.status = Number(status);
    }

    // 分页参数
    const currentPage = Number(pageNum) || 1;
    const currentPageSize = Number(pageSize) || 20;

    const [comments, total] = await Promise.all([
      prisma.tbComment.findMany({
        where,
        skip: (currentPage - 1) * currentPageSize,
        take: currentPageSize,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              path: true,
            },
          },
          user: {
            select: {
              id: true,
              nickname: true,
              account: true,
              avatar: true,
            },
          },
          parent: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  nickname: true,
                  account: true,
                },
              },
            },
          },
        },
      }),
      prisma.tbComment.count({ where }),
    ]);

    return NextResponse.json(
      successResponse({
        record: comments,
        total,
        pageNum: currentPage,
        pageSize: currentPageSize,
      })
    );
  } catch (error) {
    console.error('获取评论失败:', error);
    return NextResponse.json(
      errorResponse('获取评论失败'),
      { status: 500 }
    );
  }
}
