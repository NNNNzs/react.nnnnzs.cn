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
import { embedPost } from '@/services/embedding';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
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
    if (!token || !(await validateToken(token))) {
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

    const updatedPost = await updatePost(Number(id), validationResult.data as Partial<import('@/generated/prisma-client').TbPost>);

    if (!updatedPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 如果更新了标题、内容或隐藏状态，异步执行向量化
    const hasContentUpdate = validationResult.data.content !== undefined;
    const hasTitleUpdate = validationResult.data.title !== undefined;
    const hasHideUpdate = validationResult.data.hide !== undefined;
    if ((hasContentUpdate || hasTitleUpdate || hasHideUpdate) && updatedPost.title && updatedPost.content) {
      embedPost({
        postId: updatedPost.id,
        title: updatedPost.title,
        content: updatedPost.content,
        hide: updatedPost.hide || '0',
        force: true, // 强制更新，因为内容或状态可能已改变
      }).catch((error) => {
        console.error('文章向量化失败（异步）:', error);
        // 向量化失败不影响文章更新，只记录错误
      });
    }

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
    if (!token || !(await validateToken(token))) {
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
      validationResult.data as Partial<import('@/generated/prisma-client').TbPost>
    );

    if (!updatedPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 如果更新了标题、内容或隐藏状态，异步执行向量化
    const hasContentUpdate = validationResult.data.content !== undefined;
    const hasTitleUpdate = validationResult.data.title !== undefined;
    const hasHideUpdate = validationResult.data.hide !== undefined;
    if ((hasContentUpdate || hasTitleUpdate || hasHideUpdate) && updatedPost.title && updatedPost.content) {
      embedPost({
        postId: updatedPost.id,
        title: updatedPost.title,
        content: updatedPost.content,
        hide: updatedPost.hide || '0',
        force: true, // 强制更新，因为内容或状态可能已改变
      }).catch((error) => {
        console.error('文章向量化失败（异步）:', error);
        // 向量化失败不影响文章更新，只记录错误
      });
    }

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
    const success = await deletePost(Number(id));

    if (!success) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除文章失败:', error);
    return NextResponse.json(errorResponse('删除文章失败'), { status: 500 });
  }
}
