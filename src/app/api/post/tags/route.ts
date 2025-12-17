/**
 * 获取所有标签API
 * GET /api/post/tags
 */

import { NextResponse } from 'next/server';
import { getAllTags } from '@/services/tag';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function GET() {
  try {
    const tags = await getAllTags();
    return NextResponse.json(successResponse(tags));
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return NextResponse.json(errorResponse('获取标签列表失败'), {
      status: 500,
    });
  }
}
