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

    console.log('🔍 [缓存API] 接收到的 path 参数:', path);
    console.log('🔍 [缓存API] path 数组长度:', path?.length);

    if (!path || path.length === 0) {
      console.error('❌ [缓存API] path 参数为空');
      return NextResponse.json(errorResponse('路径参数不能为空'), { status: 400 });
    }

    // 重建完整路径
    // Next.js 会自动解码 URL 参数，所以这里 path 数组中的每个元素都是解码后的
    // 直接拼接即可，因为数据库中存储的路径也是未编码的
    const [year, month, date, title] = path;
    const fullPath = '/' + [year, month, date, title].join('/');

    console.log('🔍 [缓存API] 重建的完整路径:', fullPath);
    console.log('🔍 [缓存API] title 解码后值:', title);

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
