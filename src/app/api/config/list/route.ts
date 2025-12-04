/**
 * 配置列表API
 * GET /api/config/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigList } from '@/services/config';
import { successResponse, errorResponse } from '@/lib/auth';
import type { QueryConfigCondition } from '@/dto/config.dto';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageNum = Number(searchParams.get('pageNum')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 10;
    const query = searchParams.get('query') || '';
    const status = searchParams.get('status') ? Number(searchParams.get('status')) : undefined;

    const params: QueryConfigCondition = {
      pageNum,
      pageSize,
      query,
      status,
    };

    const result = await getConfigList(params);

    return NextResponse.json(
      successResponse(result)
    );
  } catch (error) {
    console.error('获取配置列表失败:', error);
    return NextResponse.json(errorResponse('获取配置列表失败'), {
      status: 500,
    });
  }
}
