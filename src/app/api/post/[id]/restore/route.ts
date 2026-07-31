/**
 * 恢复软删除文章 API
 * POST /api/post/[id]/restore
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostByIdIncludingDeleted, restorePost } from '@/services/post';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { POST_RESTORE } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getCollectionsByPostId } from '@/services/collection';
import { queueEmbedPost } from '@/services/embedding';
import { collectPostCacheImpact } from '@/lib/cache-impact';
import { scheduleCacheImpact } from '@/services/cache-refresh';
import { bestEffortCacheRead } from '@/services/cache-impact-snapshot';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requirePermission(request, POST_RESTORE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json(errorResponse('无效的文章 ID'), { status: 400 });
    }

    const before = await getPostByIdIncludingDeleted(postId);
    if (!before) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }
    if (before.is_delete === 0) {
      return NextResponse.json(errorResponse('文章未处于删除状态'), { status: 409 });
    }
    if (!hasDataPermission(check.user, POST_RESTORE, before.created_by)) {
      return NextResponse.json(errorResponse('无权限恢复此文章'), { status: 403 });
    }

    const collections = await bestEffortCacheRead(
      `post:${postId}:restore-collections`,
      () => getCollectionsByPostId(postId),
      [],
    );
    const restored = await restorePost(postId);
    if (!restored) {
      return NextResponse.json(errorResponse('文章恢复失败'), { status: 409 });
    }

    // 删除时会移除向量；恢复是唯一允许重新进入检索队列的回收站操作。
    if (restored.content?.trim()) {
      await queueEmbedPost({
        postId: restored.id,
        title: restored.title || '',
        content: restored.content,
        hide: restored.hide || '0',
        priority: 5,
      });
    }

    scheduleCacheImpact(collectPostCacheImpact({
      kind: 'update',
      before,
      after: restored,
      beforeCollections: collections,
      afterCollections: collections,
      changedFields: ['is_delete'],
    }));

    return NextResponse.json(successResponse(restored, '恢复成功'));
  } catch (error) {
    console.error('恢复文章失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '恢复文章失败'),
      { status: 500 },
    );
  }
}
