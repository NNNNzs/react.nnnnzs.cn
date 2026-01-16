/**
 * 博客文章详情API
 * GET /api/post/[id]
 * PUT /api/post/[id]
 * PATCH /api/post/[id]
 * DELETE /api/post/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPostById, getPostByTitle, updatePost, deletePost } from '@/services/post';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { revalidateTag, revalidatePath } from 'next/cache';
// 定义文章更新的验证schema
const updatePostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200个字符').optional(),
  content: z.string().min(1, '内容不能为空').optional(),
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
  visitors: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
});

/**
 * 获取文章详情
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 判断是ID还是标题
    let post;
    if (isNaN(Number(id))) {
      // 是标题
      const decodedTitle = decodeURIComponent(id);
      post = await getPostByTitle(decodedTitle);
    } else {
      // 是ID
      post = await getPostById(Number(id));
    }

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(post));
  } catch (error) {
    console.error('获取文章详情失败:', error);
    return NextResponse.json(errorResponse('获取文章详情失败'), {
      status: 500,
    });
  }
}

/**
 * 更新文章
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;
    
    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const body = await request.json();

    // 使用Zod验证输入
    const validationResult = updatePostSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const { id } = await context.params;

    const updatedPost = await updatePost(
      Number(id),
      validationResult.data as Partial<import('@/generated/prisma-client').TbPost>,
      user?.id
    );

    if (!updatedPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 清除缓存（精细化控制）
    revalidateTag('post', {}); // 清除所有文章列表缓存
    revalidateTag(`post:${updatedPost.id}`, {}); // 清除按 ID 的缓存

    // 从 path 中提取 slug（最后一部分）
    if (updatedPost.path) {
      const slug = updatedPost.path.split('/').pop();
      if (slug) {
        revalidateTag(`post:${slug}`, {}); // 清除按 slug 的缓存
      }
      revalidatePath(updatedPost.path); // 清除路径缓存
    }

    // 清除列表页缓存
    revalidateTag('home', {}); // 清除首页缓存
    revalidateTag('post-list', {}); // 清除文章列表缓存
    revalidateTag('tags', {}); // 清除标签列表缓存
    revalidateTag('tag-list', {}); // 清除标签列表缓存
    revalidateTag('archives', {}); // 清除归档页缓存

    // 清除标签页缓存（如果文章有标签）
    if (updatedPost.tags) {
      const tags = Array.isArray(updatedPost.tags) ? updatedPost.tags : String(updatedPost.tags).split(',');
      tags.forEach((tag: string) => {
        const trimmedTag = typeof tag === 'string' ? tag.trim() : tag;
        if (trimmedTag) {
          revalidatePath(`/tags/${encodeURIComponent(trimmedTag)}`);
        }
      });
    }

    // 注意：向量化现在在 updatePost 函数中通过增量向量化处理（创建版本和chunk记录）
    // 这里不再需要单独调用 embedPost

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('更新文章失败:', error);
    return NextResponse.json(errorResponse('更新文章失败'), { status: 500 });
  }
}

/**
 * 部分更新文章
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;
    
    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const body = await request.json();

    // 检查是否有要更新的字段
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        errorResponse('请求体不能为空，至少需要提供一个要更新的字段'),
        { status: 400 }
      );
    }

    // 使用Zod验证输入（允许部分字段）
    const validationResult = updatePostSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const { id } = await context.params;

    const updatedPost = await updatePost(
      Number(id),
      validationResult.data as Partial<import('@/generated/prisma-client').TbPost>,
      user.id
    );

    if (!updatedPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 清除缓存（精细化控制）
    revalidateTag('post', {}); // 清除所有文章列表缓存
    revalidateTag(`post:${updatedPost.id}`, {}); // 清除按 ID 的缓存

    // 从 path 中提取 slug（最后一部分）
    if (updatedPost.path) {
      const slug = updatedPost.path.split('/').pop();
      if (slug) {
        revalidateTag(`post:${slug}`, {}); // 清除按 slug 的缓存
      }
      revalidatePath(updatedPost.path); // 清除路径缓存
    }

    // 清除列表页缓存
    revalidateTag('home', {}); // 清除首页缓存
    revalidateTag('post-list', {}); // 清除文章列表缓存
    revalidateTag('tags', {}); // 清除标签列表缓存
    revalidateTag('tag-list', {}); // 清除标签列表缓存
    revalidateTag('archives', {}); // 清除归档页缓存

    // 清除标签页缓存（如果文章有标签）
    if (updatedPost.tags) {
      const tags = Array.isArray(updatedPost.tags) ? updatedPost.tags : String(updatedPost.tags).split(',');
      tags.forEach((tag: string) => {
        const trimmedTag = typeof tag === 'string' ? tag.trim() : tag;
        if (trimmedTag) {
          revalidatePath(`/tags/${encodeURIComponent(trimmedTag)}`);
        }
      });
    }

    // 注意：向量化现在在 updatePost 函数中通过增量向量化处理（创建版本和chunk记录）
    // 这里不再需要单独调用 embedPost

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('部分更新文章失败:', error);
    return NextResponse.json(errorResponse('部分更新文章失败'), { status: 500 });
  }
}

/**
 * 删除文章（软删除）
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token || !(await validateToken(token))) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const { id } = await context.params;
    const postId = Number(id);

    // 先获取文章信息用于清除缓存
    const post = await getPostById(postId);
    const success = await deletePost(postId);

    if (!success) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 清除缓存（精细化控制）
    revalidateTag('post', {}); // 清除所有文章列表缓存
    revalidateTag(`post:${postId}`, {}); // 清除按 ID 的缓存

    // 从 path 中提取 slug（最后一部分）
    if (post?.path) {
      const slug = post.path.split('/').pop();
      if (slug) {
        revalidateTag(`post:${slug}`, {}); // 清除按 slug 的缓存
      }
      revalidatePath(post.path); // 清除路径缓存
    }

    // 清除列表页缓存
    revalidateTag('home', {}); // 清除首页缓存
    revalidateTag('post-list', {}); // 清除文章列表缓存
    revalidateTag('tags', {}); // 清除标签列表缓存
    revalidateTag('tag-list', {}); // 清除标签列表缓存
    revalidateTag('archives', {}); // 清除归档页缓存

    // 清除标签页缓存（如果文章有标签）
    if (post?.tags) {
      const tags = Array.isArray(post.tags) ? post.tags : String(post.tags).split(',');
      tags.forEach((tag: string) => {
        const trimmedTag = typeof tag === 'string' ? tag.trim() : tag;
        if (trimmedTag) {
          revalidatePath(`/tags/${encodeURIComponent(trimmedTag)}`);
        }
      });
    }

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除文章失败:', error);
    return NextResponse.json(errorResponse('删除文章失败'), { status: 500 });
  }
}
