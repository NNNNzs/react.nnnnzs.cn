/**
 * 更新文章喜欢数或访问量API
 * PUT /api/post/fav?id=1&type=likes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostRepository } from '@/lib/repositories';
import { successResponse, errorResponse } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const type = searchParams.get('type') as 'likes' | 'visitors';

    if (!id || !type || (type !== 'likes' && type !== 'visitors')) {
      return NextResponse.json(errorResponse('参数错误'), { status: 400 });
    }

    const postRepository = await getPostRepository();

    // 找到文章
    const post = await postRepository.findOne({
      where: { id: Number(id) },
    });

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 更新统计
    const currentValue = (post[type] || 0) as number;
    await postRepository.update(Number(id), {
      [type]: currentValue + 1,
    });

    // 获取更新后的文章
    const updatedPost = await postRepository.findOne({
      where: { id: Number(id) },
    });

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('更新文章统计失败:', error);
    return NextResponse.json(errorResponse('更新文章统计失败'), {
      status: 500,
    });
  }
}
