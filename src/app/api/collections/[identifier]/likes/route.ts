/**
 * 合集点赞 API
 * POST /api/collections/[identifier]/likes
 * 支持通过 id 或 slug 点赞
 */

import { NextRequest, NextResponse } from 'next/server';
import { incrementCollectionLikes, getCollectionBySlug } from '@/services/collection';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    let collectionId: number | null = null;

    if (!identifier) {
      return NextResponse.json(
        {
          status: false,
          message: 'identifier 参数缺失',
        },
        { status: 400 }
      );
    }

    // 尝试作为数字 ID 查询
    if (/^\d+$/.test(identifier)) {
      collectionId = parseInt(identifier, 10);
    } else {
      // 作为 slug 查询，获取 ID
      const collection = await getCollectionBySlug(identifier);
      if (collection) {
        collectionId = collection.id;
      }
    }

    if (!collectionId) {
      return NextResponse.json(
        {
          status: false,
          message: '合集不存在',
        },
        { status: 404 }
      );
    }

    const success = await incrementCollectionLikes(collectionId);

    if (!success) {
      return NextResponse.json(
        {
          status: false,
          message: '点赞失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: true,
      message: '点赞成功',
    });
  } catch (error) {
    console.error('❌ 合集点赞失败:', error);
    return NextResponse.json(
      {
        status: false,
        message: '合集点赞失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
