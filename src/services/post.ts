import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import type { QueryCondition, PageQueryRes, Archive } from '@/dto/post.dto';
import { TbPost } from '@/entities/post.entity';
import dayjs from 'dayjs';

/**
 * 生成文章路径
 */
function genPath(title: string, date: Date | string): string {
  const dateObj = dayjs(date);
  const year = dateObj.format('YYYY');
  const month = dateObj.format('MM');
  const day = dateObj.format('DD');
  const slug = encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'));
  return `/${year}/${month}/${day}/${slug}`;
}

/**
 * 生成背景图
 */
function genCover(date: Date | string): string {
  const dateStr = dayjs(date).format('YYYYMMDD');
  return `https://static.nnnnzs.cn/bing/${dateStr}.png`;
}

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
    record: serializedData as TbPost[], 
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
      path: path, // Exact match
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
 * 根据标题获取文章
 */
export async function getPostByTitle(title: string): Promise<TbPost | null> {
  const postRepository = await getPostRepository();
  const post = await postRepository.findOne({
    where: { 
        title: title, 
        is_delete: 0 
    },
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
export async function createPost(data: Partial<TbPost>): Promise<TbPost> {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  // 生成path
  const path = genPath(data.title || '', data.date || now);
  
  // 生成cover
  const cover = data.cover || genCover(data.date || now);

  const postData = {
    ...data,
    path, // Use generated path
    cover, // Use generated/provided cover
    date: data.date ? dayjs(data.date).format('YYYY-MM-DD HH:mm:ss') : now,
    updated: now,
    hide: data.hide || '0',
    is_delete: 0,
    visitors: 0,
    likes: 0,
  };

  const postRepository = await getPostRepository();
  const result = await postRepository.save(postData as TbPost);
  
  // 序列化
  const savedPost = { ...result };
  savedPost.date = savedPost.date ? new Date(savedPost.date).toISOString() : null;
  savedPost.updated = savedPost.updated ? new Date(savedPost.updated).toISOString() : null;
  
  return savedPost as TbPost;
}

/**
 * 更新文章
 */
export async function updatePost(id: number, data: Partial<TbPost>): Promise<TbPost | null> {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const updateData: Partial<TbPost> = {
    ...data,
    updated: now,
  };

  // 如果有title，重新生成path
  if (data.title) {
     // 如果没有传入date，尝试使用现有data.date或者当前时间（这里假设updateData包含了完整数据或者至少包含date）
     // 如果data是partial update，可能没有date。
     // 但是前端通常传所有字段。
     // 安全起见，如果data.date存在，用data.date。如果不存在，可能需要查库？
     // 根据page.tsx，提交时会带上date。
     const date = data.date || now;
     updateData.path = genPath(data.title, date);
  }

  // 如果cover为空字符串，生成cover
  if (data.cover === '' || data.cover === null || data.cover === undefined) {
      // 检查是否应该生成。用户说“如果传空”。
      // 如果本来有cover，传空是想删除吗？还是生成默认？
      // 用户说 "cover user if passed empty in frontend, also put to server side generation".
      // 这意味着空字符串 = 生成默认。
      const date = data.date || now;
      updateData.cover = genCover(date);
  }

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
