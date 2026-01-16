/**
 * 合集管理 API (更新、删除)
 * PUT /api/collection/[id]
 * DELETE /api/collection/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { updateCollection, deleteCollection, getCollectionById } from '@/services/collection';
import { revalidateTag, revalidatePath } from 'next/cache';
import { canManageCollections } from '@/lib/permission';

// 定义合集更新的验证schema
const updateCollectionSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符').optional(),
  slug: z.string().min(1, 'slug不能为空').max(255, 'slug不能超过255个字符').regex(/^[a-z0-9-]+$/, 'slug只能包含小写字母、数字和连字符').optional(),
  description: z.string().max(1000, '描述不能超过1000个字符').optional().nullable(),
  cover: z.string().url('无效的 URL').optional().nullable(),
  background: z.string().url('无效的 URL').optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色必须是十六进制格式，如 #2563eb').optional().nullable(),
  status: z.enum(['0', '1']).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    // 检查权限：只有管理员可以更新合集
    if (!canManageCollections(user)) {
      return NextResponse.json(errorResponse('无权限更新合集'), { status: 403 });
    }

    const { id } = await params;
    const collectionId = parseInt(id, 10);

    if (isNaN(collectionId)) {
      return NextResponse.json(errorResponse('无效的合集 ID'), { status: 400 });
    }

    const body = await request.json();

    // 使用Zod验证输入
    const validationResult = updateCollectionSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    // 转换 status 为数字
    const updateData: Record<string, unknown> = { ...validationResult.data };
    if (updateData.status !== undefined) {
      updateData.status = parseInt(updateData.status as string, 10);
    }

    // 获取更新前的合集（用于清除旧 slug 的缓存）
    const oldCollection = await getCollectionById(collectionId);

    const result = await updateCollection(collectionId, updateData);

    if (!result) {
      return NextResponse.json(errorResponse('合集不存在'), { status: 404 });
    }

    // 清除缓存
    revalidateTag('collection', {}); // 清除合集列表缓存
    revalidatePath(`/collections/${result.slug}`); // 清除新路径缓存

    // 如果 slug 改变，清除旧路径缓存
    if (oldCollection && oldCollection.slug !== result.slug) {
      revalidatePath(`/collections/${oldCollection.slug}`);
    }

    return NextResponse.json(successResponse(result, '更新成功'));
  } catch (error) {
    console.error('更新合集失败:', error);
    return NextResponse.json(errorResponse('更新合集失败'), { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    // 检查权限：只有管理员可以删除合集
    if (!canManageCollections(user)) {
      return NextResponse.json(errorResponse('无权限删除合集'), { status: 403 });
    }

    const { id } = await params;
    const collectionId = parseInt(id, 10);

    if (isNaN(collectionId)) {
      return NextResponse.json(errorResponse('无效的合集 ID'), { status: 400 });
    }

    // 获取合集信息（用于清除缓存）
    const collection = await getCollectionById(collectionId);
    const success = await deleteCollection(collectionId);

    if (!success) {
      return NextResponse.json(errorResponse('合集不存在'), { status: 404 });
    }

    // 清除缓存
    revalidateTag('collection', {}); // 清除合集列表缓存
    if (collection) {
      revalidatePath(`/collections/${collection.slug}`); // 清除合集详情页
    }

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除合集失败:', error);
    return NextResponse.json(errorResponse('删除合集失败'), { status: 500 });
  }
}
