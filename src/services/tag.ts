import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import { TbPost } from '@/entities/post.entity';

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
    if (post.tags) {
      post.tags.split(',').forEach((tag) => {
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

  // 序列化日期
  return posts.map(post => ({
    ...post,
    date: post.date ? new Date(post.date).toISOString() : null,
    updated: post.updated ? new Date(post.updated).toISOString() : null,
  }));
}

