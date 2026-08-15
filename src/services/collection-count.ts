import { getPrisma } from '@/lib/prisma';
import type { Prisma, PrismaClient } from '@/generated/prisma-client/client';

type CollectionDbClient = PrismaClient | Prisma.TransactionClient;

const PUBLIC_POST_FILTER = {
  post: {
    is_delete: 0,
    hide: '0',
  },
} as const;

/** 获取一个合集当前可公开展示的文章数。 */
export async function countPublicCollectionPosts(
  collectionId: number,
  db: CollectionDbClient,
): Promise<number> {
  return db.tbCollectionPost.count({
    where: {
      collection_id: collectionId,
      ...PUBLIC_POST_FILTER,
    },
  });
}

/**
 * 批量获取合集的公开文章数，供公开列表读取时绕过可能过期的冗余字段。
 */
export async function getPublicCollectionArticleCounts(
  collectionIds: number[],
  db: CollectionDbClient,
): Promise<Map<number, number>> {
  if (collectionIds.length === 0) return new Map();

  const relations = await db.tbCollectionPost.findMany({
    where: {
      collection_id: { in: collectionIds },
      ...PUBLIC_POST_FILTER,
    },
    select: { collection_id: true },
  });

  const counts = new Map<number, number>();
  for (const relation of relations) {
    counts.set(relation.collection_id, (counts.get(relation.collection_id) || 0) + 1);
  }
  return counts;
}

/** 将合集冗余计数字段同步为公开文章数。 */
export async function refreshCollectionArticleCount(
  collectionId: number,
  db: CollectionDbClient,
): Promise<number> {
  const count = await countPublicCollectionPosts(collectionId, db);
  await db.tbCollection.update({
    where: { id: collectionId },
    data: { article_count: count },
  });
  return count;
}

/** 同步一篇文章所属全部合集的公开文章数。 */
export async function refreshCollectionArticleCountsForPost(
  postId: number,
  db?: CollectionDbClient,
): Promise<void> {
  const client = db || await getPrisma();
  const relations = await client.tbCollectionPost.findMany({
    where: { post_id: postId },
    select: { collection_id: true },
  });

  await Promise.all(
    relations.map(({ collection_id }) => refreshCollectionArticleCount(collection_id, client)),
  );
}
