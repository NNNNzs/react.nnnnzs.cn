/**
 * 归档 API
 * GET /api/post/archives
 */

import { NextResponse } from 'next/server';
import { getArchives } from '@/services/post';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function GET() {
  try {
    const archives = await getArchives();
    return NextResponse.json(successResponse(archives));
  } catch (error) {
    console.error('获取归档失败:', error);
    return NextResponse.json(errorResponse('获取归档失败'), {
      status: 500,
    });
  }
}
