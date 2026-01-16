/**
 * 按路径获取文章详情 API（支持 Next.js 缓存标签）
 * GET /api/post/by-path/[...path]
 *
 * 用于文章详情页的 fetch 缓存，支持按需重新验证
 * 使用 next.tags 声明缓存标签，可在文章更新时通过 revalidateTag 清除缓存
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostByPath } from '@/services/post';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * 获取文章详情（支持缓存标签）
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;

    // 重建完整路径
    const fullPath = '/' + path.join('/');

    console.log('🔍 [缓存API] 获取文章路径:', fullPath);

    const post = await getPostByPath(fullPath);

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 声明缓存标签
    // 1. 文章特定标签：post:${post.id} - 精确控制单篇文章缓存
    // 2. 通用标签：post - 批量控制所有文章缓存
    const response = NextResponse.json(successResponse(post));

    // 添加缓存标签
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    response.headers.set('Next-Cache-Tags', `post:${post.id},post`);

    return response;
  } catch (error) {
    console.error('❌ 获取文章详情失败:', error);
    return NextResponse.json(errorResponse('获取文章详情失败'), {
      status: 500,
    });
  }
}

/**
 * 配置缓存策略
 */
export const fetchCache = 'force-cache';
export const dynamic = 'force-static';
