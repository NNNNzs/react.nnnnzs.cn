/**
 * 更新文章喜欢数或访问量API
 * PUT /api/post/fav?id=1&type=likes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const type = searchParams.get('type') as 'likes' | 'visitors';

    if (!id || !type || (type !== 'likes' && type !== 'visitors')) {
      return NextResponse.json(errorResponse('参数错误'), { status: 400 });
    }

    const prisma = await getPrisma();

    // 找到文章
    const post = await prisma.tbPost.findUnique({
      where: { id: Number(id) },
    });

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 更新统计
    const currentValue = (post[type] || 0) as number;
    const updatedPost = await prisma.tbPost.update({
      where: { id: Number(id) },
      data: {
        [type]: currentValue + 1,
      },
    });

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('更新文章统计失败:', error);
    return NextResponse.json(errorResponse('更新文章统计失败'), {
      status: 500,
    });
  }
}
