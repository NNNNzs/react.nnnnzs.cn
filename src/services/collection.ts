/**
 * 合集服务层
 * 参考 docs/blog-collection-design.md
 */

import { getPrisma } from '@/lib/prisma';
import {
  SerializedCollection,
  CollectionDetail,
  ArticleInCollection,
  PostCollectionInfo,
  CreateCollectionDto,
  UpdateCollectionDto,
  CollectionQueryCondition,
  CollectionPageQueryRes,
} from '@/dto/collection.dto';
import { TbCollection, TbPost } from '@/generated/prisma-client';
import { serializePost } from './post';
import { detectChanges } from '@/services/entity-change-detector';
import { createChangeLogsAsync } from '@/services/entity-change-log';
import { EntityType } from '@/types/entity-change';

/**
 * 将 Prisma 实体序列化为纯对象
 */
export function serializeCollection(collection: TbCollection): SerializedCollection {
  return {
    ...collection,
    created_at: collection.created_at?.toISOString() || '',
    updated_at: collection.updated_at?.toISOString() || '',
  };
}

/**
 * 获取合集列表
 */
export async function getCollectionList(
  params: CollectionQueryCondition
): Promise<CollectionPageQueryRes> {
  const { pageSize, pageNum, status } = params;
  const prisma = await getPrisma();

  // 构建 where 条件：只有当 status 存在且为有效数字时才添加
  const where: { is_delete: number; status?: number } = {
    is_delete: 0,
  };
  if (status !== undefined && !isNaN(status)) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.tbCollection.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
    }),
    prisma.tbCollection.count({
      where,
    }),
  ]);

  return {
    record: data.map(serializeCollection),
    total,
    pageNum,
    pageSize,
  };
}

/**
 * 根据slug获取合集详情及文章
 */
export async function getCollectionBySlug(slug: string): Promise<CollectionDetail | null> {
  const prisma = await getPrisma();

  const collection = await prisma.tbCollection.findFirst({
    where: { slug, status: 1, is_delete: 0 },
    include: {
      // 通过中间表关联文章，按 sort_order 排序
      collectionPosts: {
        select: {
          sort_order: true,
          post: {
            select: {
              id: true,
              title: true,
              path: true,
              description: true,
              cover: true,
              date: true,
              visitors: true,
              likes: true,
              tags: true,
              category: true,
              layout: true,
              updated: true,
              hide: true,
              created_by: true,
            },
          },
        },
        orderBy: { sort_order: 'asc' },
        where: {
          post: {
            is_delete: 0,
            hide: '0',
          },
        },
      },
    },
  });

  if (!collection) return null;

  // 处理文章数据，提取 sort_order
  const articles: ArticleInCollection[] = collection.collectionPosts
    .map((cp) => {
      const post = serializePost(cp.post as TbPost);
      return {
        ...post,
        sort_order: cp.sort_order,
      };
    })
    .filter((article) => article !== null) as ArticleInCollection[];

  // 更新浏览量（异步执行，不阻塞响应）
  incrementCollectionViews(collection.id).catch((error) => {
    console.error(`❌ 更新合集 ${collection.id} 浏览量失败:`, error);
  });

  return {
    ...serializeCollection(collection),
    articles,
  };
}

/**
 * 根据ID获取合集详情
 */
export async function getCollectionById(id: number): Promise<SerializedCollection | null> {
  const prisma = await getPrisma();

  const collection = await prisma.tbCollection.findFirst({
    where: { id, is_delete: 0 },
  });

  return collection ? serializeCollection(collection) : null;
}

/**
 * 创建合集
 */
export async function createCollection(data: CreateCollectionDto): Promise<SerializedCollection> {
  const prisma = await getPrisma();

  const collection = await prisma.tbCollection.create({
    data: {
      title: data.title,
      slug: data.slug,
      description: data.description || null,
      cover: data.cover || null,
      background: data.background || null,
      color: data.color || null,
      created_by: data.created_by || null,
    },
  });

  return serializeCollection(collection);
}

/**
 * 更新合集
 */
export async function updateCollection(
  id: number,
  data: UpdateCollectionDto
): Promise<SerializedCollection | null> {
  const prisma = await getPrisma();

  try {
    // 先获取现有合集数据
    const existingCollection = await prisma.tbCollection.findUnique({
      where: { id },
    });

    if (!existingCollection) {
      return null;
    }

    // 准备更新数据
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.cover !== undefined) updateData.cover = data.cover;
    if (data.background !== undefined) updateData.background = data.background;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.status !== undefined) updateData.status = data.status;

    // 执行更新
    const collection = await prisma.tbCollection.update({
      where: { id },
      data: updateData,
    });

    // 检测字段变更并记录日志（异步执行，不阻塞响应）
    const changes = detectChanges(
      EntityType.COLLECTION,
      existingCollection,
      updateData
    );

    if (changes.length > 0) {
      createChangeLogsAsync({
        entityId: id,
        entityType: EntityType.COLLECTION,
        changes,
        userId: data.updated_by,
      });
    }

    return serializeCollection(collection);
  } catch {
    // 记录不存在
    return null;
  }
}

/**
 * 删除合集（软删除）
 */
export async function deleteCollection(id: number): Promise<boolean> {
  const prisma = await getPrisma();

  try {
    await prisma.tbCollection.update({
      where: { id },
      data: { is_delete: 1 },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * 将文章添加到合集
 */
export async function addPostsToCollection(
  collectionId: number,
  postIds: number[],
  sortOrders?: number[]
) {
  const prisma = await getPrisma();

  // 开始事务
  const result = await prisma.$transaction(async (tx) => {
    // 先查询现有文章，避免重复
    const existing = await tx.tbCollectionPost.findMany({
      where: {
        collection_id: collectionId,
        post_id: { in: postIds },
      },
      select: { post_id: true },
    });

    const existingIds = existing.map((e) => e.post_id);
    const newPostIds = postIds.filter((id) => !existingIds.includes(id));

    // 批量创建关联
    const createData = newPostIds.map((postId, index) => ({
      collection_id: collectionId,
      post_id: postId,
      sort_order: sortOrders?.[index] ?? 0,
    }));

    if (createData.length > 0) {
      await tx.tbCollectionPost.createMany({ data: createData });
    }

    // 更新合集的 article_count
    const count = await tx.tbCollectionPost.count({
      where: { collection_id: collectionId },
    });

    await tx.tbCollection.update({
      where: { id: collectionId },
      data: { article_count: count },
    });

    return { created: createData.length };
  });

  return result;
}

/**
 * 从合集移除文章
 */
export async function removePostsFromCollection(collectionId: number, postIds: number[]) {
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.tbCollectionPost.deleteMany({
      where: {
        collection_id: collectionId,
        post_id: { in: postIds },
      },
    });

    // 更新计数
    const count = await tx.tbCollectionPost.count({
      where: { collection_id: collectionId },
    });

    await tx.tbCollection.update({
      where: { id: collectionId },
      data: { article_count: count },
    });
  });

  return true;
}

/**
 * 调整合集内文章顺序
 */
export async function updateCollectionOrder(
  collectionId: number,
  orders: { post_id: number; sort_order: number }[]
) {
  const prisma = await getPrisma();

  await prisma.$transaction(
    orders.map(({ post_id, sort_order }) =>
      prisma.tbCollectionPost.updateMany({
        where: { collection_id: collectionId, post_id },
        data: { sort_order },
      })
    )
  );

  return true;
}

/**
 * 获取文章所属的合集
 */
export async function getCollectionsByPostId(postId: number): Promise<PostCollectionInfo[]> {
  const prisma = await getPrisma();

  const relations = await prisma.tbCollectionPost.findMany({
    where: {
      post_id: postId,
      collection: { status: 1, is_delete: 0 },
    },
    include: {
      collection: {
        select: {
          id: true,
          title: true,
          slug: true,
          cover: true,
          color: true,
        },
      },
    },
    orderBy: { sort_order: 'asc' },
  });

  return relations.map((r) => ({
    ...r.collection,
    sort_order: r.sort_order,
  }));
}

/**
 * 增加合集浏览量
 */
export async function incrementCollectionViews(id: number) {
  const prisma = await getPrisma();

  try {
    await prisma.tbCollection.update({
      where: { id },
      data: { total_views: { increment: 1 } },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * 增加合集点赞数
 */
export async function incrementCollectionLikes(id: number) {
  const prisma = await getPrisma();

  try {
    await prisma.tbCollection.update({
      where: { id },
      data: { total_likes: { increment: 1 } },
    });

    return true;
  } catch {
    return false;
  }
}
