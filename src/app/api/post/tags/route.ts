/**
 * 获取所有标签API
 * GET /api/post/tags
 */

import { NextResponse } from 'next/server';
import { getPostRepository } from '@/lib/repositories';
import { successResponse, errorResponse } from '@/lib/auth';

export async function GET() {
  try {
    const postRepository = await getPostRepository();

    // 获取所有未删除且显示的文章的标签
    const posts = await postRepository.find({
      where: {
        hide: '0',
        is_delete: 0,
      },
      select: ['tags'],
    });

    // 统计标签
    const tagMap = new Map<string, number>();
    posts.forEach((post) => {
      if (post.tags) {
        post.tags.split(',').forEach((tag) => {
          const trimmedTag = tag.trim();
          if (trimmedTag) {
            tagMap.set(trimmedTag, (tagMap.get(trimmedTag) || 0) + 1);
          }
        });
      }
    });

    // 转换为数组格式
    const tags = Array.from(tagMap.entries());

    return NextResponse.json(successResponse(tags));
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return NextResponse.json(errorResponse('获取标签列表失败'), {
      status: 500,
    });
  }
}
