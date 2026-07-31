/**
 * 调整合集内文章顺序 API
 * PUT /api/collection/[id]/posts/sort
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/permission';
import { COLLECTION_EDIT } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getCollectionById, updateCollectionOrder } from '@/services/collection';
import { getPostById } from '@/services/post';
import { collectCollectionCacheImpact } from '@/lib/cache-impact';
import { scheduleCacheImpact } from '@/services/cache-refresh';

// 调整顺序验证schema
const updateOrderSchema = z.object({
  orders: z.array(z.object({
    post_id: z.coerce.number(),
    sort_order: z.number(),
  })).min(1, '至少需要一篇文章'),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, COLLECTION_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { id } = await params;
    const collectionId = parseInt(id, 10);

    if (isNaN(collectionId)) {
      return NextResponse.json(errorResponse('无效的合集 ID'), { status: 400 });
    }

    const body = await request.json();

    // 使用Zod验证输入
    const validationResult = updateOrderSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    await updateCollectionOrder(collectionId, validationResult.data.orders);

    try {
      const collection = await getCollectionById(collectionId);
      if (collection) {
        const posts = (await Promise.all(
          validationResult.data.orders.map(({ post_id }) => getPostById(post_id)),
        )).filter((post): post is NonNullable<typeof post> => Boolean(post));
        scheduleCacheImpact(collectCollectionCacheImpact({
          collectionSlug: collection.slug,
          posts,
          membershipChanged: false,
        }));
      }
    } catch (error) {
      console.error('收集合集排序缓存影响失败，不影响排序结果:', error);
    }

    return NextResponse.json(successResponse(null, '排序调整成功'));
  } catch (error) {
    console.error('调整合集内文章顺序失败:', error);
    return NextResponse.json(errorResponse('调整合集内文章顺序失败'), { status: 500 });
  }
}
