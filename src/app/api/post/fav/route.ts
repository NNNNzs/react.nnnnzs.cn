/**
 * 更新文章喜欢数或访问量API
 * PUT /api/post/fav?id=1&type=likes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { revalidateTag, revalidatePath } from 'next/cache';

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

    // 清除缓存（精细化控制）
    revalidateTag('post', {}); // 清除所有文章列表缓存
    revalidateTag(`post:${id}`, {}); // 清除按 ID 的缓存

    // 从 path 中提取 slug（最后一部分）
    if (updatedPost.path) {
      const slug = updatedPost.path.split('/').pop();
      if (slug) {
        revalidateTag(`post:${slug}`, {}); // 清除按 slug 的缓存
      }
      revalidatePath(updatedPost.path); // 清除路径缓存
    }

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('更新文章统计失败:', error);
    return NextResponse.json(errorResponse('更新文章统计失败'), {
      status: 500,
    });
  }
}
