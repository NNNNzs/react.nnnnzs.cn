/**
 * 合集详情 API
 * GET /api/collections/[identifier]
 * 支持通过 id 或 slug 查询
 * 注意：此 API 返回完整的合集详情，包括文章列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionBySlug } from '@/services/collection';
import { getPrisma } from '@/lib/prisma';
import { serializeCollection } from '@/services/collection';
import { serializePost } from '@/services/post';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;

    if (!identifier) {
      return NextResponse.json(
        {
          status: false,
          message: 'identifier 参数缺失',
        },
        { status: 400 }
      );
    }

    let collection = null;

    // 尝试作为数字 ID 查询
    if (/^\d+$/.test(identifier)) {
      const prisma = await getPrisma();
      const id = parseInt(identifier, 10);

      const collectionData = await prisma.tbCollection.findFirst({
        where: { id, is_delete: 0 },
        include: {
          collectionPosts: {
            where: { post: { is_delete: 0 } },
            include: {
              post: true,
            },
            orderBy: { sort_order: 'asc' },
          },
        },
      });

      if (!collectionData) {
        return NextResponse.json(
          {
            status: false,
            message: '合集不存在',
          },
          { status: 404 }
        );
      }

      // 构建文章列表
      const articles = collectionData.collectionPosts
        .map((cp) => {
          if (!cp.post || cp.post.is_delete === 1) {
            return null;
          }
          return {
            ...serializePost(cp.post),
            sort_order: cp.sort_order,
          };
        })
        .filter((article) => article !== null);

      collection = {
        ...serializeCollection(collectionData),
        articles,
      };
    } else {
      // 作为 slug 查询
      collection = await getCollectionBySlug(identifier);
    }

    if (!collection) {
      return NextResponse.json(
        {
          status: false,
          message: '合集不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: true,
      data: collection,
    });
  } catch (error) {
    console.error('❌ 获取合集详情失败:', error);
    return NextResponse.json(
      {
        status: false,
        message: '获取合集详情失败',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
