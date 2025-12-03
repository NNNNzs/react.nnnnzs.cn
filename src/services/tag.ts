import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import { TbPost } from '@/entities/post.entity';

/**
 * 确保 tags 字段是数组格式
 * 防御性转换，处理 transformer 可能未生效的情况
 */
function ensureTagsIsArray(post: TbPost): TbPost {
  if (post.tags && typeof post.tags === 'string') {
    // 如果是字符串，转换为数组
    post.tags = post.tags.split(',').map(tag => tag.trim()).filter(Boolean);
  } else if (!post.tags) {
    // 如果是 null 或 undefined，设置为空数组
    post.tags = [];
  }
  // 如果已经是数组，保持不变
  return post;
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

  // 统计标签（确保 tags 是数组类型）
  const tagMap = new Map<string, number>();
  posts.forEach((post) => {
    ensureTagsIsArray(post);
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

  // 确保 tags 是数组格式并序列化日期
  return posts.map(post => {
    const processedPost = ensureTagsIsArray(post);
    return {
      ...processedPost,
      date: processedPost.date ? new Date(processedPost.date).toISOString() : null,
      updated: processedPost.updated ? new Date(processedPost.updated).toISOString() : null,
    };
  });
}

