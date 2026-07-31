/**
 * 回滚到指定版本 API
 * POST /api/post/[id]/versions/[version]/rollback
 */

import { NextRequest, NextResponse } from 'next/server';
import { rollbackToVersion } from '@/services/post-version';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPostByIdIncludingDeleted, updatePost } from '@/services/post';
import { getCollectionsByPostId } from '@/services/collection';
import { collectPostCacheImpact } from '@/lib/cache-impact';
import { scheduleCacheImpact } from '@/services/cache-refresh';
import { bestEffortCacheRead } from '@/services/cache-impact-snapshot';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { POST_EDIT } from '@/constants/permissions';

/**
 * 回滚到指定版本
 */
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; version: string }>;
  }
) {
  try {
    const check = await requirePermission(request, POST_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id, version } = await context.params;
    const postId = Number(id);
    const versionNum = Number(version);

    if (isNaN(postId) || isNaN(versionNum)) {
      return NextResponse.json(errorResponse('无效的参数'), { status: 400 });
    }
    const before = await getPostByIdIncludingDeleted(postId);
    if (!before) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }
    if (!hasDataPermission(check.user, POST_EDIT, before.created_by)) {
      return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
    }
    const collections = before.is_delete === 0
      ? await bestEffortCacheRead(
        `post:${postId}:before-rollback`,
        () => getCollectionsByPostId(postId),
        [],
      )
      : [];

    // 回滚到指定版本（创建新版本）
    const newVersion = await rollbackToVersion(postId, versionNum, check.user.id);

    // 更新文章内容为回滚后的内容
    const after = await updatePost(postId, {
      content: newVersion.content,
    });
    if (before.is_delete === 0 && after) {
      scheduleCacheImpact(collectPostCacheImpact({
        kind: 'rollback',
        before,
        after,
        beforeCollections: collections,
        afterCollections: collections,
        changedFields: ['content'],
      }));
    }

    return NextResponse.json(
      successResponse(newVersion, '回滚成功，已创建新版本')
    );
  } catch (error) {
    console.error('回滚版本失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '回滚版本失败';
    return NextResponse.json(errorResponse(errorMessage), {
      status: 500,
    });
  }
}
