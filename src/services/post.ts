import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import type { QueryCondition, PageQueryRes, Archive } from '@/dto/post.dto';
import { TbPost } from '@/entities/post.entity';
import dayjs from 'dayjs';

/**
 * 获取文章列表
 */
export async function getPostList(params: QueryCondition): Promise<PageQueryRes<TbPost>> {
  const { pageNum = 1, pageSize = 10, hide = '0', query = '' } = params;
  
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

  // 序列化日期对象，防止传递给客户端组件时报错
  const serializedData = data.map(post => ({
    ...post,
    date: post.date ? new Date(post.date).toISOString() : null,
    updated: post.updated ? new Date(post.updated).toISOString() : null,
  }));

  return {
    record: serializedData as TbPost[], // Cast back to TbPost since we just changed types slightly for serialization but structure matches
    total: count,
    pageNum,
    pageSize,
  };
}

/**
 * 根据路径获取文章
 */
export async function getPostByPath(path: string): Promise<TbPost | null> {
  const postRepository = await getPostRepository();
  const post = await postRepository.findOne({
    where: {
      path: Like(`%${path}%`), // Use Like for partial match or exact match depending on requirement. Original code used Like.
      is_delete: 0,
    },
  });
  
  if (post) {
    // Serialize dates
    post.date = post.date ? new Date(post.date).toISOString() : null;
    post.updated = post.updated ? new Date(post.updated).toISOString() : null;
  }

  return post;
}

/**
 * 根据标题或旧标题获取文章
 */
export async function getPostByTitle(title: string): Promise<TbPost | null> {
  const postRepository = await getPostRepository();
  const post = await postRepository.findOne({
    where: [
        { title: title, is_delete: 0 },
        { oldTitle: title, is_delete: 0 }
    ],
  });
  
  if (post) {
    post.date = post.date ? new Date(post.date).toISOString() : null;
    post.updated = post.updated ? new Date(post.updated).toISOString() : null;
  }
  return post;
}

/**
 * 根据ID获取文章
 */
export async function getPostById(id: number): Promise<TbPost | null> {
  const postRepository = await getPostRepository();
  const post = await postRepository.findOne({
    where: {
      id,
      is_delete: 0,
    },
  });

  if (post) {
    // Serialize dates
    post.date = post.date ? new Date(post.date).toISOString() : null;
    post.updated = post.updated ? new Date(post.updated).toISOString() : null;
  }

  return post;
}

/**
 * 获取归档数据
 */
export async function getArchives(): Promise<Archive[]> {
  const postRepository = await getPostRepository();
  const posts = await postRepository.find({
    where: {
      hide: '0',
      is_delete: 0,
    },
    order: {
      date: 'DESC',
    },
    select: ['id', 'title', 'date', 'path'],
  });

  // 按年份分组
  const archivesMap = new Map<string, TbPost[]>();
  
  posts.forEach((post) => {
    // 序列化日期
    post.date = post.date ? new Date(post.date).toISOString() : null;
    post.updated = post.updated ? new Date(post.updated).toISOString() : null;

    if (post.date) {
      const year = dayjs(post.date).format('YYYY');
      if (!archivesMap.has(year)) {
        archivesMap.set(year, []);
      }
      archivesMap.get(year)?.push(post);
    }
  });

  // 转换为数组并排序
  const archives: Archive[] = Array.from(archivesMap.entries())
    .map(([year, posts]) => ({
      year,
      posts,
    }))
    .sort((a, b) => Number(b.year) - Number(a.year));

  return archives;
}

/**
 * 创建文章
 */
export async function createPost(data: any): Promise<TbPost> {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const postData = {
    ...data,
    date: now,
    updated: now,
    hide: data.hide || '0',
    is_delete: 0,
    visitors: 0,
    likes: 0,
  };

  const postRepository = await getPostRepository();
  const result = await postRepository.save(postData);
  
  // 序列化
  const savedPost = { ...result };
  savedPost.date = savedPost.date ? new Date(savedPost.date).toISOString() : null;
  savedPost.updated = savedPost.updated ? new Date(savedPost.updated).toISOString() : null;
  
  return savedPost as TbPost;
}

/**
 * 更新文章
 */
export async function updatePost(id: number, data: any): Promise<TbPost | null> {
  const updateData = {
    ...data,
    updated: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  };

  const postRepository = await getPostRepository();
  await postRepository.update(id, updateData);

  const updatedPost = await postRepository.findOne({
    where: { id },
  });

  if (updatedPost) {
      updatedPost.date = updatedPost.date ? new Date(updatedPost.date).toISOString() : null;
      updatedPost.updated = updatedPost.updated ? new Date(updatedPost.updated).toISOString() : null;
  }

  return updatedPost;
}

/**
 * 删除文章
 */
export async function deletePost(id: number): Promise<boolean> {
  const postRepository = await getPostRepository();
  const result = await postRepository.update(id, {
    is_delete: 1,
  });
  return result.affected !== 0;
}
