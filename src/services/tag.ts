import { Like } from 'typeorm';
import { isArray, isString } from 'lodash-es';
import { getPostRepository } from '@/lib/repositories';
import { TbPost } from '@/entities/post.entity';

/**
 * 将 TypeORM 实体序列化为纯对象，确保 tags 是数组格式
 */
function serializePost(post: TbPost): TbPost {
  // 转换为纯对象（移除 TypeORM 的类实例）
  const plain = JSON.parse(JSON.stringify(post));
  
  // 确保 tags 是数组格式
  const rawTags = post.tags as string[] | string | null | undefined;
  plain.tags = isArray(rawTags) 
    ? rawTags 
    : isString(rawTags) 
      ? rawTags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
  
  // 序列化日期
  plain.date = post.date ? new Date(post.date).toISOString() : null;
  plain.updated = post.updated ? new Date(post.updated).toISOString() : null;
  
  return plain as TbPost;
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
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach((tag) => {
        const trimmedTag = tag.trim();
        if (trimmedTag) {
          tagMap.set(trimmedTag, (tagMap.get(trimmedTag) || 0) + 1);
        }
      });
    }
  });

  // 转换为数组格式并排序
  const tags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);
  return tags;
}

/**
 * 根据标签获取文章列表
 */
export async function getPostsByTag(tag: string): Promise<TbPost[]> {
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

  // 序列化日期并确保 tags 是数组格式
  return posts.map(post => serializePost(post));
}

