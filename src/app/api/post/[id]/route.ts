/**
 * 博客文章详情API
 * GET /api/post/[id]
 * PUT /api/post/[id]
 * DELETE /api/post/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostRepository } from '@/lib/repositories';
import {
  successResponse,
  errorResponse,
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import dayjs from 'dayjs';

/**
 * 获取文章详情
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const postRepository = await getPostRepository();
    const { id } = await context.params;

    // 判断是ID还是标题
    let post;
    if (isNaN(Number(id))) {
      // 是标题
      const decodedTitle = decodeURIComponent(id);
      post = await postRepository.findOne({
        where: [{ title: decodedTitle }, { oldTitle: decodedTitle }],
      });
    } else {
      // 是ID
      post = await postRepository.findOne({
        where: { id: Number(id) },
      });
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
    const updateData = {
      ...body,
      updated: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };

    const postRepository = await getPostRepository();
    const { id } = await context.params;
    await postRepository.update(Number(id), updateData);

    const updatedPost = await postRepository.findOne({
      where: { id: Number(id) },
    });

    if (!updatedPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('更新文章失败:', error);
    return NextResponse.json(errorResponse('更新文章失败'), { status: 500 });
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

    const postRepository = await getPostRepository();
    const { id } = await context.params;
    const result = await postRepository.update(Number(id), {
      is_delete: 1,
    });

    if (result.affected === 0) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除文章失败:', error);
    return NextResponse.json(errorResponse('删除文章失败'), { status: 500 });
  }
}
