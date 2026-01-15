/**
 * 文章所属合集 API
 * GET /api/post/[id]/collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionsByPostId } from '@/services/collection';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json(
        {
          status: false,
          message: '无效的文章 ID',
        },
        { status: 400 }
      );
    }

    const collections = await getCollectionsByPostId(postId);

    return NextResponse.json({
      status: true,
      data: collections,
    });
  } catch (error) {
    console.error('❌ 获取文章所属合集失败:', error);
    return NextResponse.json(
      {
        status: false,
        message: '获取文章所属合集失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
