import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
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
function serializePost(post: import('@/entities/post.entity').TbPost): SerializedPost {
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
  const postRepository = await getPostRepository();

  // 获取所有未删除且显示的文章的标签
  const posts = await postRepository.find({
    where: {
      hide: '0',
      is_delete: 0,
    },
    select: ['tags'],
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
  const postRepository = await getPostRepository();

  const posts = await postRepository.find({
    where: {
      hide: '0',
      is_delete: 0,
      tags: Like(`%${tag}%`),
    },
    order: {
      date: 'DESC',
    },
  });

  // 序列化文章
  return posts.map(post => serializePost(post));
}

