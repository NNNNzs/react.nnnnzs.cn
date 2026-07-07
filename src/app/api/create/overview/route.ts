import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import { getContentCreationOverview } from '@/services/content-creation';

export async function GET(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const result = await getContentCreationOverview();
    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('获取内容创作概览失败:', error);
    return NextResponse.json(errorResponse('获取内容创作概览失败'), { status: 500 });
  }
}
