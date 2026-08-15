import { NextRequest, NextResponse } from 'next/server';
import { POST_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { collectPostCacheImpact } from '@/lib/cache-impact';
import { hasDataPermission, requirePermission } from '@/lib/permission';
import { batchSeoIndexingSchema } from '@/lib/post-seo-indexing';
import { scheduleCacheImpact } from '@/services/cache-refresh';
import { getCollectionsByPostId } from '@/services/collection';
import {
  BatchPostSeoIndexingError,
  updatePostsSeoIndexing,
} from '@/services/post';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = {
  code: 'post_seo_indexing_batch',
  name: '批量设置文章 SEO 收录状态',
  description: '最多批量设置 50 篇文章是否允许搜索引擎索引，不改变公开访问、正文更新时间或向量数据。',
  module: 'post',
  method: 'PATCH',
  permissionCode: POST_EDIT,
  inputSchema: {
    type: 'object',
    properties: {
      postIds: { type: 'array', description: '文章 ID，1 至 50 个且不可重复', items: { type: 'number' } },
      seoIndexable: { type: 'boolean', description: '是否允许搜索引擎索引' },
    },
    required: ['postIds', 'seoIndexable'],
  },
};

export async function PATCH(request: NextRequest) {
  try {
    const check = await requirePermission(request, POST_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = batchSeoIndexingSchema.safeParse(await request.json());
    if (!validation.success) {
      const message = validation.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(errorResponse(`输入验证失败: ${message}`), { status: 400 });
    }

    const collectionEntries = await Promise.all(
      validation.data.postIds.map(async (postId) => [postId, await getCollectionsByPostId(postId)] as const),
    );
    const collectionsByPostId = new Map(collectionEntries);
    const mutation = await updatePostsSeoIndexing({
      ...validation.data,
      userId: check.user.id,
      canEditAll: hasDataPermission(check.user, POST_EDIT),
    });

    mutation.after.forEach((after, index) => {
      const before = mutation.before[index];
      if (before.seo_indexable === after.seo_indexable) return;
      const collections = collectionsByPostId.get(after.id) || [];
      scheduleCacheImpact(collectPostCacheImpact({
        kind: 'update',
        before,
        after,
        beforeCollections: collections,
        afterCollections: collections,
        changedFields: ['seo_indexable'],
      }));
    });

    return NextResponse.json(
      successResponse({
        updatedCount: mutation.updatedCount,
        seoIndexable: mutation.seoIndexable,
      }),
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  } catch (error) {
    if (error instanceof BatchPostSeoIndexingError) {
      return NextResponse.json(errorResponse(error.message), { status: error.status });
    }
    console.error('批量设置文章 SEO 收录状态失败:', error);
    return NextResponse.json(errorResponse('批量设置文章 SEO 收录状态失败'), { status: 500 });
  }
}
