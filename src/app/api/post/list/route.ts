/**
 * 博客文章列表API
 * GET /api/post/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import { successResponse, errorResponse } from '@/lib/auth';
import type { QueryCondition } from '@/dto/post.dto';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageNum = Number(searchParams.get('pageNum')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 10;
    const hide = searchParams.get('hide') || '0';
    const query = searchParams.get('query') || '';

    const params: QueryCondition = {
      pageNum,
      pageSize,
      hide,
      query,
    };

    const postRepository = await getPostRepository();

    // 构建查询条件
    const whereConditions = [];
    const baseCondition = {
      is_delete: 0,
      ...(hide !== 'all' && { hide }),
    };

    if (query) {
      whereConditions.push(
        { ...baseCondition, content: Like(`%${query}%`) },
        { ...baseCondition, title: Like(`%${query}%`) }
      );
    } else {
      whereConditions.push(baseCondition);
    }

    // 查询数据
    const [data, count] = await postRepository.findAndCount({
      where: whereConditions,
      order: {
        date: 'DESC',
      },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
      select: {
        id: true,
        path: true,
        title: true,
        oldTitle: true,
        category: true,
        tags: true,
        date: true,
        updated: true,
        cover: true,
        layout: true,
        description: true,
        visitors: true,
        likes: true,
        hide: true,
        // content 不在列表中返回
      },
    });

    return NextResponse.json(
      successResponse({
        record: data,
        total: count,
        pageNum,
        pageSize,
      })
    );
  } catch (error) {
    console.error('获取文章列表失败:', error);
    return NextResponse.json(errorResponse('获取文章列表失败'), {
      status: 500,
    });
  }
}
