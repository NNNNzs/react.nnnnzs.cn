/**
 * 文章所属合集 API
 * GET /api/post/[id]/collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionsByPostId } from '@/services/collection';
import { getPostByIdIncludingDeleted } from '@/services/post';
import { getAuthUserFromRequest } from '@/lib/auth';
import { canViewPost } from '@/lib/permission';

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

    const post = await getPostByIdIncludingDeleted(postId);
    if (!post) {
      return NextResponse.json({ status: false, message: '文章不存在' }, { status: 404 });
    }
    const user = await getAuthUserFromRequest(request.headers);
    if (!canViewPost(user, post)) {
      return NextResponse.json({ status: false, message: '无权限查看此文章' }, { status: 403 });
    }

    const collections = await getCollectionsByPostId(postId);

    return NextResponse.json({
      status: true,
      data: collections,
    }, {
      headers: post.hide === '1' || post.is_delete !== 0
        ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
        : undefined,
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
