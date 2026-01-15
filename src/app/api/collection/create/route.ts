/**
 * 创建合集 API
 * POST /api/collection/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { createCollection } from '@/services/collection';

// 定义合集创建的验证schema
const createCollectionSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符'),
  slug: z.string().min(1, 'slug不能为空').max(255, 'slug不能超过255个字符').regex(/^[a-z0-9-]+$/, 'slug只能包含小写字母、数字和连字符'),
  description: z.string().max(1000, '描述不能超过1000个字符').optional().nullable(),
  cover: z.string().url('无效的 URL').optional().nullable(),
  background: z.string().url('无效的 URL').optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色必须是十六进制格式，如 #2563eb').optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const body = await request.json();

    // 使用Zod验证输入
    const validationResult = createCollectionSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const result = await createCollection({
      ...validationResult.data,
      created_by: user.id,
    });

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建合集失败:', error);
    return NextResponse.json(errorResponse('创建合集失败'), { status: 500 });
  }
}
