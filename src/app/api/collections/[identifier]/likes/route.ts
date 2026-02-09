/**
 * 合集点赞 API
 * POST /api/collections/[identifier]/likes
 * 支持通过 id 或 slug 点赞
 * 新增：IP 防刷逻辑
 */

import { NextRequest, NextResponse } from 'next/server';
import { incrementCollectionLikes, getCollectionBySlug } from '@/services/collection';
import { canLike, recordLike } from '@/services/like-record';
import { trackEvent, createSessionCookie } from '@/lib/analytics';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    let collectionId: number | null = null;

    if (!identifier) {
      return NextResponse.json(errorResponse('identifier 参数缺失'), { status: 400 });
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
      return NextResponse.json(errorResponse('合集不存在'), { status: 404 });
    }

    // 检查 IP 限制
    const canLikeThis = await canLike('COLLECTION', collectionId, request);

    if (!canLikeThis) {
      return NextResponse.json(errorResponse('您已经点过赞了'), { status: 429 });
    }

    // 记录点赞
    await recordLike('COLLECTION', collectionId, request);

    // 增加点赞数
    const success = await incrementCollectionLikes(collectionId);

    if (!success) {
      return NextResponse.json(errorResponse('点赞失败'), { status: 404 });
    }

    // 发送 GA4 事件并处理 Session Cookie
    const gaResult = await trackEvent('like', {
      target_type: 'COLLECTION',
      target_id: collectionId,
    }, request);

    // 构建响应
    const response = NextResponse.json(successResponse({ message: '点赞成功' }));

    // 如果需要设置 Cookie，添加到响应头
    if (gaResult.needsSetCookie) {
      response.headers.set('Set-Cookie', createSessionCookie(gaResult.sessionId));
    }

    return response;
  } catch (error) {
    console.error('❌ 合集点赞失败:', error);
    return NextResponse.json(errorResponse('合集点赞失败'), {
      status: 500,
    });
  }
}
