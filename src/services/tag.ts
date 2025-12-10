import { getPrisma } from '@/lib/prisma';
import { SerializedPost } from '@/dto/post.dto';

/**
 * 将字符串标签转换为数组
 */
function parseTagsString(tags: string | null | undefined): string[] {
  if (!tags || typeof tags !== 'string') {
    return [];
  }
  return tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

/**
 * 序列化文章对象
 * 手动将数据库的字符串格式转换为前端需要的数组格式
 */
function serializePost(post: import('@/generated/prisma-client').TbPost): SerializedPost {
  return {
    ...post,
    tags: parseTagsString(post.tags),
    date: post.date ? new Date(post.date).toISOString() : null,
    updated: post.updated ? new Date(post.updated).toISOString() : null,
  };
}

/**
 * 获取所有标签及其文章数量
 */
export async function getAllTags(): Promise<[string, number][]> {
  const prisma = await getPrisma();

  // 获取所有未删除且显示的文章的标签
  const posts = await prisma.tbPost.findMany({
    where: {
      hide: '0',
      is_delete: 0,
    },
    select: {
      tags: true,
    },
  });

  // 统计标签
  const tagMap = new Map<string, number>();
  posts.forEach((post) => {
    // 手动解析字符串格式的 tags
    const tagsArray = parseTagsString(post.tags);
    tagsArray.forEach((tag) => {
      if (tag) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    });
  });

  // 转换为数组格式并排序
  const tags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);
  return tags;
}

/**
 * 根据标签获取文章列表
 */
export async function getPostsByTag(tag: string): Promise<SerializedPost[]> {
  const prisma = await getPrisma();

  // 清理标签输入，防止注入攻击
  const sanitizedTag = tag.trim().replace(/[,;%_\\]/g, '');

  if (!sanitizedTag) {
    return [];
  }

  // 使用精确匹配模式，避免部分匹配
  // 匹配三种情况：标签在开头、中间或末尾
  const posts = await prisma.tbPost.findMany({
    where: {
      hide: '0',
      is_delete: 0,
      OR: [
        { tags: { equals: sanitizedTag } }, // 只有一个标签
        { tags: { startsWith: `${sanitizedTag},` } }, // 标签在开头
        { tags: { endsWith: `,${sanitizedTag}` } }, // 标签在末尾
        { tags: { contains: `,${sanitizedTag},` } }, // 标签在中间
      ],
    },
    orderBy: {
      date: 'desc',
    },
  });

  // 序列化文章
  return posts.map(post => serializePost(post));
}
