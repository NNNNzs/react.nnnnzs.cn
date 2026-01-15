/**
 * 合集列表 API
 * GET /api/collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionList } from '@/services/collection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const pageNum = parseInt(searchParams.get('pageNum') || '1', 10);
    const statusParam = searchParams.get('status');

    // 参数验证
    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        {
          status: false,
          message: 'pageSize 必须在 1-100 之间',
        },
        { status: 400 }
      );
    }

    if (pageNum < 1) {
      return NextResponse.json(
        {
          status: false,
          message: 'pageNum 必须大于 0',
        },
        { status: 400 }
      );
    }

    // 处理 status 参数：如果是 'all' 或无效值，则不传递 status
    let status: number | undefined;
    if (statusParam && statusParam !== 'all') {
      const parsedStatus = parseInt(statusParam, 10);
      if (!isNaN(parsedStatus)) {
        status = parsedStatus;
      }
    }

    const result = await getCollectionList({
      pageSize,
      pageNum,
      ...(status !== undefined && { status }),
    });

    return NextResponse.json({
      status: true,
      data: result,
    });
  } catch (error) {
    console.error('❌ 获取合集列表失败:', error);
    return NextResponse.json(
      {
        status: false,
        message: '获取合集列表失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
