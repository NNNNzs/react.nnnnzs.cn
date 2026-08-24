/**
 * 向量搜索 API
 * POST /api/search/vector
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedTexts } from '@/services/embedding';
import { searchSimilarVectors } from '@/services/embedding/vector-store';
import { requirePermission } from '@/lib/permission';
import { VECTOR_VIEW } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getIndexablePostIds } from '@/services/post';

/**
 * POST /api/search/vector
 * 执行向量相似度搜索
 */
export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, VECTOR_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
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

    // 应用层最终安全过滤：校验 hide、is_delete 和 seo_indexable。
    // Qdrant 的 hide='0' 过滤只是第一层优化，不能替代数据库状态。
    const validPostIds = results.map(r => r.postId);
    let filteredResults = results;

    if (validPostIds.length > 0) {
      const validIds = await getIndexablePostIds(validPostIds);
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
