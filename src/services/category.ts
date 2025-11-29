import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import { TbPost } from '@/entities/post.entity';

/**
 * 获取所有分类及其文章数量
 */
export async function getAllCategories(): Promise<[string, number][]> {
  const postRepository = await getPostRepository();

  // 获取所有未删除且显示的文章的分类
  const posts = await postRepository.find({
    where: {
      hide: '0',
      is_delete: 0,
    },
    select: ['category'],
  });

  // 统计分类
  const categoryMap = new Map<string, number>();
  posts.forEach((post) => {
    if (post.category) {
      const category = post.category.trim();
      if (category) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      }
    }
  });

  // 转换为数组格式并排序
  const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
  return categories;
}

/**
 * 根据分类获取文章列表
 */
export async function getPostsByCategory(category: string): Promise<TbPost[]> {
  const postRepository = await getPostRepository();

  const posts = await postRepository.find({
    where: {
      hide: '0',
      is_delete: 0,
      category: category, // Exact match for category usually
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

