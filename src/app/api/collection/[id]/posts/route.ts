/**
 * 合集文章关联管理 API
 * POST /api/collection/[id]/posts - 添加文章到合集
 * DELETE /api/collection/[id]/posts - 从合集移除文章
 * PUT /api/collection/[id]/posts/sort - 调整文章顺序
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import {
  addPostsToCollection,
  removePostsFromCollection,
} from '@/services/collection';

// 添加文章验证schema
const addPostsSchema = z.object({
  post_ids: z.array(z.coerce.number()).min(1, '至少需要一个文章ID'),
  sort_orders: z.array(z.number()).optional(),
});

// 移除文章验证schema
const removePostsSchema = z.object({
  post_ids: z.array(z.coerce.number()).min(1, '至少需要一个文章ID'),
});

export async function POST(
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
      validationResult.data.sort_orders
    );

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
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

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

    await removePostsFromCollection(collectionId, validationResult.data.post_ids);

    return NextResponse.json(successResponse(null, '文章已从合集中移除'));
  } catch (error) {
    console.error('从合集移除文章失败:', error);
    return NextResponse.json(errorResponse('从合集移除文章失败'), { status: 500 });
  }
}
