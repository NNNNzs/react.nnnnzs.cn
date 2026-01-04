/**
 * 文章向量化 API
 * POST /api/post/embed
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { embedPost } from '@/services/embedding';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * 向量化请求验证 schema
 */
const embedPostSchema = z.object({
  postId: z.number().int().positive('文章ID必须为正整数'),
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
});

/**
 * 文章向量化接口
 */
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
    const validationResult = embedPostSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const { postId, title, content } = validationResult.data;

    // 执行向量化
    const result = await embedPost({
      postId,
      title,
      content,
    });

    return NextResponse.json(
      successResponse(result, '文章向量化成功')
    );
  } catch (error) {
    console.error('文章向量化失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '文章向量化失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
