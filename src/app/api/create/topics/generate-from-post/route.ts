import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import { generateTopicsFromPost } from '@/services/content-creation';
import { validationErrorResponse } from '../../_utils';

const generateTopicsSchema = z.object({
  postId: z.coerce.number().int().positive('博客文章 ID 必须是正整数'),
  limit: z.coerce.number().int().min(1).max(8).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = generateTopicsSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await generateTopicsFromPost({
      postId: validation.data.postId,
      limit: validation.data.limit,
      userId: check.user.id,
    });

    return NextResponse.json(successResponse(result, 'AI 选题已生成'));
  } catch (error) {
    console.error('AI 生成选题失败:', error);
    const message = error instanceof Error ? error.message : 'AI 生成选题失败';
    return NextResponse.json(errorResponse(message), { status: 500 });
  }
}
