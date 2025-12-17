/**
 * 根据标签获取文章列表API
 * GET /api/post/tags/[tag]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostsByTag } from '@/services/tag';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tag: string }> }
) {
  try {
    const { tag: rawTag } = await context.params;
    const tag = decodeURIComponent(rawTag);
    
    const posts = await getPostsByTag(tag);

    return NextResponse.json(successResponse(posts));
  } catch (error) {
    console.error('获取标签文章失败:', error);
    return NextResponse.json(errorResponse('获取标签文章失败'), {
      status: 500,
    });
  }
}
