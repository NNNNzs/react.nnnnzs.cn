/**
 * 增强版文章查询 API
 * GET /api/post/query
 * 支持时间范围、排序、标签筛选等多种查询方式
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * 将字符串标签转换为数组
 */
function parseTagsString(tags: string | null | undefined): string[] {
  if (!tags || typeof tags !== 'string') {
    return [];
  }
  return tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

/**
 * 查询参数
 */
interface QueryParams {
  limit?: number;
  offset?: number;
  sort_by?: 'date' | 'updated' | 'visitors' | 'likes';
  sort_order?: 'asc' | 'desc';
  tags?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  keyword?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const params: QueryParams = {
      limit: Number(searchParams.get('limit')) || 20,
      offset: Number(searchParams.get('offset')) || 0,
      sort_by: (searchParams.get('sort_by') as any) || 'date',
      sort_order: (searchParams.get('sort_order') as any) || 'desc',
      tags: searchParams.get('tags') || '',
      category: searchParams.get('category') || '',
      date_from: searchParams.get('date_from') || '',
      date_to: searchParams.get('date_to') || '',
      keyword: searchParams.get('keyword') || '',
    };

    // 限制 limit 最大值
    if (params.limit! > 100) {
      params.limit = 100;
    }

    const prisma = await getPrisma();

    // 构建 where 条件
    const where: Record<string, unknown> = {
      is_delete: 0,
      hide: '0',
    };

    // 标签筛选（逗号分隔）
    if (params.tags) {
      const tagList = params.tags.split(',').map(t => t.trim()).filter(t => t);
      if (tagList.length > 0) {
        // 匹配包含任一标签的文章
        where.OR = tagList.map(tag => ({
          tags: { contains: tag },
        }));
      }
    }

    // 分类筛选
    if (params.category) {
      where.category = params.category;
    }

    // 关键词搜索
    if (params.keyword) {
      const keywordCondition = {
        OR: [
          { title: { contains: params.keyword } },
          { description: { contains: params.keyword } },
        ],
      };
      // 如果已经有 OR 条件（标签筛选），需要合并
      if (where.OR) {
        where.OR = [
          ...where.OR as Array<unknown>,
          ...keywordCondition.OR as Array<unknown>,
        ];
      } else {
        Object.assign(where, keywordCondition);
      }
    }

    // 时间范围筛选
    if (params.date_from || params.date_to) {
      const dateCondition: Record<string, unknown> = {};
      if (params.date_from) {
        dateCondition.gte = new Date(params.date_from);
      }
      if (params.date_to) {
        dateCondition.lte = new Date(params.date_to);
      }
      where.date = dateCondition;
    }

    // 构建排序
    let orderBy: Record<string, 'asc' | 'desc'> = {};
    if (params.sort_by === 'date') {
      orderBy = { date: params.sort_order! };
    } else if (params.sort_by === 'updated') {
      orderBy = { updated: params.sort_order! };
    } else if (params.sort_by === 'visitors') {
      orderBy = { visitors: params.sort_order! };
    } else if (params.sort_by === 'likes') {
      orderBy = { likes: params.sort_order! };
    }

    // 查询文章
    const [posts, total] = await Promise.all([
      prisma.tbPost.findMany({
        where,
        orderBy,
        take: params.limit,
        skip: params.offset,
        select: {
          id: true,
          title: true,
          path: true,
          description: true,
          date: true,
          updated: true,
          tags: true,
          category: true,
          visitors: true,
          likes: true,
          cover: true,
        },
      }),
      prisma.tbPost.count({ where }),
    ]);

    // 手动序列化结果
    const results = posts.map((post) => ({
      ...post,
      tags: parseTagsString(post.tags),
      date: post.date ? post.date.toISOString() : null,
      updated: post.updated ? post.updated.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        results,
        total,
        limit: params.limit,
        offset: params.offset,
      },
    });
  } catch (error) {
    console.error('增强版文章查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '查询失败',
      },
      { status: 500 }
    );
  }
}
