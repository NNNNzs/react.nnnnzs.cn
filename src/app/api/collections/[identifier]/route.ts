/**
 * 合集详情 API
 * GET /api/collections/[identifier]
 * 支持通过 id 或 slug 查询
 * 注意：此 API 返回完整的合集详情，包括文章列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionBySlug, getPublicCollectionById } from '@/services/collection';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;

    if (!identifier) {
      return NextResponse.json(
        {
          status: false,
          message: 'identifier 参数缺失',
        },
        { status: 400 }
      );
    }

    const collection = /^\d+$/.test(identifier)
      ? await getPublicCollectionById(Number.parseInt(identifier, 10))
      : await getCollectionBySlug(identifier);

    if (!collection) {
      return NextResponse.json(
        {
          status: false,
          message: '合集不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: true,
      data: collection,
    });
  } catch (error) {
    console.error('❌ 获取合集详情失败:', error);
    return NextResponse.json(
      {
        status: false,
        message: '获取合集详情失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
