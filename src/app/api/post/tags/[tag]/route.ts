/**
 * 根据标签获取文章列表API
 * GET /api/post/tags/[tag]
 */

import { NextRequest, NextResponse } from 'next/server';
import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import { successResponse, errorResponse } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  try {
    const tag = decodeURIComponent(params.tag);
    const postRepository = await getPostRepository();

    const posts = await postRepository.find({
      where: {
        hide: '0',
        is_delete: 0,
        tags: Like(`%${tag}%`),
      },
      order: {
        date: 'DESC',
      },
    });

    return NextResponse.json(successResponse(posts));
  } catch (error) {
    console.error('获取标签文章失败:', error);
    return NextResponse.json(errorResponse('获取标签文章失败'), {
      status: 500,
    });
  }
}
