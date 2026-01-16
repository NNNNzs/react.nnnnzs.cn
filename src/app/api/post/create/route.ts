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
import { revalidateTag, revalidatePath } from 'next/cache';

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

    // 清除缓存（精细化控制）
    revalidateTag('post', {}); // 清除所有文章列表缓存
    revalidateTag(`post:${result.id}`, {}); // 清除按 ID 的缓存

    // 从 path 中提取 slug（最后一部分）
    if (result.path) {
      const slug = result.path.split('/').pop();
      if (slug) {
        revalidateTag(`post:${slug}`, {}); // 清除按 slug 的缓存
      }
      revalidatePath(result.path); // 清除路径缓存
    }

    // 清除列表页缓存
    revalidateTag('home', {}); // 清除首页缓存
    revalidateTag('post-list', {}); // 清除文章列表缓存
    revalidateTag('tags', {}); // 清除标签列表缓存
    revalidateTag('tag-list', {}); // 清除标签列表缓存
    revalidateTag('archives', {}); // 清除归档页缓存

    // 清除标签页缓存（如果文章有标签）
    if (result.tags) {
      const tags = Array.isArray(result.tags) ? result.tags : String(result.tags).split(',');
      tags.forEach((tag: string) => {
        const trimmedTag = typeof tag === 'string' ? tag.trim() : tag;
        if (trimmedTag) {
          revalidatePath(`/tags/${encodeURIComponent(trimmedTag)}`);
        }
      });
    }

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建文章失败:', error);
    return NextResponse.json(errorResponse('创建文章失败'), { status: 500 });
  }
}
