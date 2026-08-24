/**
 * 获取所有标签API
 * GET /api/post/tags
 */

import { NextResponse } from 'next/server';
import { getAllTags } from '@/services/tag';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function GET() {
  try {
    // 后台编辑器需要看到全部公开文章的历史标签，不能把 seo_indexable 当成管理数据权限。
    const tags = await getAllTags(false);
    return NextResponse.json(successResponse(tags));
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return NextResponse.json(errorResponse('获取标签列表失败'), {
      status: 500,
    });
  }
}
