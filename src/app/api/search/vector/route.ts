/**
 * 向量搜索 API
 * POST /api/search/vector
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedTexts } from '@/services/embedding';
import { searchSimilarVectors } from '@/services/embedding/vector-store';
import { getTokenFromRequest, validateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { isAdmin } from '@/types/role';
import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/search/vector
 * 执行向量相似度搜索
 */
export async function POST(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    // 权限检查：仅管理员可使用
    if (!isAdmin(user.role)) {
      return NextResponse.json(errorResponse('权限不足，仅管理员可使用'), { status: 403 });
    }

    const body = await request.json();
    const { query, limit = 10 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(errorResponse('请提供有效的搜索内容'), { status: 400 });
    }

    if (query.trim().length === 0) {
      return NextResponse.json(errorResponse('搜索内容不能为空'), { status: 400 });
    }

    // 生成查询向量
    console.log('🔍 生成查询向量...');
    const [embedding] = await embedTexts([query]);

    // 执行向量搜索
    console.log('🔍 执行向量搜索...');
    const results = await searchSimilarVectors(embedding, limit);

    console.log(`✅ 向量搜索完成，找到 ${results.length} 个结果`);

    // ⚠️ 应用层安全过滤：排除已删除的文章
    // 虽然 Qdrant 已经过滤了 hide='0'，但还需要在应用层检查 is_delete
    const validPostIds = results.map(r => r.postId);
    let filteredResults = results;

    if (validPostIds.length > 0) {
      const prisma = await getPrisma();
      const posts = await prisma.tbPost.findMany({
        where: {
          id: { in: validPostIds },
          is_delete: 0,  // ✅ 只返回未删除的文章
        },
        select: {
          id: true,
        },
      });

      const validIds = new Set(posts.map(p => p.id));
      filteredResults = results.filter(r => validIds.has(r.postId));

      if (filteredResults.length < results.length) {
        console.log(`⚠️ 过滤了 ${results.length - filteredResults.length} 个已删除的文章`);
      }
    }

    console.log(`✅ 最终返回 ${filteredResults.length} 个有效结果`);

    return NextResponse.json(
      successResponse({
        results: filteredResults,
        count: filteredResults.length,
      })
    );
  } catch (error) {
    console.error('向量搜索失败:', error);
    const errorMessage = error instanceof Error ? error.message : '向量搜索失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
