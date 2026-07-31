/**
 * 合集文章关联管理 API
 * POST /api/collection/[id]/posts - 添加文章到合集
 * DELETE /api/collection/[id]/posts - 从合集移除文章
 * PUT /api/collection/[id]/posts/sort - 调整文章顺序
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/permission';
import { COLLECTION_EDIT, COLLECTION_VIEW } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import {
  addPostsToCollection,
  getCollectionArticlesForManagement,
  getCollectionById,
  removePostsFromCollection,
} from '@/services/collection';
import { getPostById } from '@/services/post';
import { collectCollectionCacheImpact } from '@/lib/cache-impact';
import { scheduleCacheImpact } from '@/services/cache-refresh';

// 添加文章验证schema
const addPostsSchema = z.object({
  post_ids: z.array(z.coerce.number()).min(1, '至少需要一个文章ID'),
  sort_orders: z.array(z.number()).optional(),
});

// 移除文章验证schema
const removePostsSchema = z.object({
  post_ids: z.array(z.coerce.number()).min(1, '至少需要一个文章ID'),
});

async function scheduleCollectionContent(
  collectionId: number,
  postIds: number[],
): Promise<void> {
  try {
    const collection = await getCollectionById(collectionId);
    if (!collection) return;
    const posts = (await Promise.all(postIds.map((postId) => getPostById(postId))))
      .filter((post): post is NonNullable<typeof post> => Boolean(post));
    scheduleCacheImpact(collectCollectionCacheImpact({
      collectionSlug: collection.slug,
      posts,
      membershipChanged: true,
    }));
  } catch (error) {
    console.error('收集合集缓存影响失败，不影响关联操作:', error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requirePermission(request, COLLECTION_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await params;
    const collectionId = Number.parseInt(id, 10);
    if (!Number.isInteger(collectionId) || collectionId <= 0) {
      return NextResponse.json(errorResponse('无效的合集 ID'), { status: 400 });
    }

    const articles = await getCollectionArticlesForManagement(collectionId);
    if (!articles) {
      return NextResponse.json(errorResponse('合集不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse({ articles }), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('获取合集文章失败:', error);
    return NextResponse.json(errorResponse('获取合集文章失败'), { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, COLLECTION_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await params;
    const collectionId = parseInt(id, 10);

    if (isNaN(collectionId)) {
      return NextResponse.json(errorResponse('无效的合集 ID'), { status: 400 });
    }

    const body = await request.json();

    // 使用Zod验证输入
    const validationResult = addPostsSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const result = await addPostsToCollection(
      collectionId,
      validationResult.data.post_ids,
      validationResult.data.sort_orders,
      user.id
    );

    await scheduleCollectionContent(collectionId, validationResult.data.post_ids);

    return NextResponse.json(successResponse(result, `成功添加 ${result.created} 篇文章到合集`));
  } catch (error) {
    console.error('添加文章到合集失败:', error);
    return NextResponse.json(errorResponse('添加文章到合集失败'), { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, COLLECTION_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await params;
    const collectionId = parseInt(id, 10);

    if (isNaN(collectionId)) {
      return NextResponse.json(errorResponse('无效的合集 ID'), { status: 400 });
    }

    const body = await request.json();

    // 使用Zod验证输入
    const validationResult = removePostsSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    await removePostsFromCollection(collectionId, validationResult.data.post_ids, user.id);
    await scheduleCollectionContent(collectionId, validationResult.data.post_ids);

    return NextResponse.json(successResponse(null, '文章已从合集中移除'));
  } catch (error) {
    console.error('从合集移除文章失败:', error);
    return NextResponse.json(errorResponse('从合集移除文章失败'), { status: 500 });
  }
}
