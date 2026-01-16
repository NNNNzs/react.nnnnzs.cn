/**
 * 调整合集内文章顺序 API
 * PUT /api/collection/[id]/posts/sort
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { updateCollectionOrder } from '@/services/collection';
import { canManageCollections } from '@/lib/permission';

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
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    // 检查权限：只有管理员可以调整合集文章顺序
    if (!canManageCollections(user)) {
      return NextResponse.json(errorResponse('无权限调整合集文章顺序'), { status: 403 });
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

    return NextResponse.json(successResponse(null, '排序调整成功'));
  } catch (error) {
    console.error('调整合集内文章顺序失败:', error);
    return NextResponse.json(errorResponse('调整合集内文章顺序失败'), { status: 500 });
  }
}
