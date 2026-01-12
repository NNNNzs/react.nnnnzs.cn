/**
 * 创建博客文章API
 * POST /api/post/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPost } from '@/services/post';
import { embedPost } from '@/services/embedding';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
// 定义文章创建的验证schema
const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200个字符'),
  content: z.string().min(1, '内容不能为空'),
  category: z.string().optional().nullable(),
  tags: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional().nullable(),
  description: z.string().max(500, '描述不能超过500个字符').optional().nullable(),
  cover: z.string().optional().nullable(),
  layout: z.string().optional().nullable(),
  date: z.union([
    z.string().transform(str => new Date(str)),
    z.date(),
  ]).optional().nullable(),
  hide: z.enum(['0', '1']).optional(),
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
    const validationResult = createPostSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const result = await createPost({
      ...(validationResult.data as Partial<import('@/generated/prisma-client').TbPost>),
      // 创建人使用当前登录用户
      created_by: user.id,
    });

    // 异步执行向量化（不阻塞响应）
    if (result.id && result.title && result.content) {
      embedPost({
        postId: result.id,
        title: result.title,
        content: result.content,
        hide: result.hide || '0',
      }).catch((error) => {
        console.error('文章向量化失败（异步）:', error);
        // 向量化失败不影响文章创建，只记录错误
      });
    }

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建文章失败:', error);
    return NextResponse.json(errorResponse('创建文章失败'), { status: 500 });
  }
}
