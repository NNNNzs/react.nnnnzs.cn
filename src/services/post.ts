import { Like } from 'typeorm';
import { isArray, isString } from 'lodash-es';
import { getPostRepository } from '@/lib/repositories';
import type { QueryCondition, PageQueryRes, Archive } from '@/dto/post.dto';
import { TbPost } from '@/entities/post.entity';
import dayjs from 'dayjs';

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
 * 生成文章路径
 */
function genPath(title: string, date: Date | string): string {
  const dateObj = dayjs(date);
  const year = dateObj.format('YYYY');
  const month = dateObj.format('MM');
  const day = dateObj.format('DD');
  const slug = title.trim().replace(/\s+/g, '-');
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

  // 序列化日期对象并确保 tags 是数组格式
  const serializedData = data.map(post => serializePost(post));

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
      path: path,
      is_delete: 0,
    },
  });
  
  return post ? serializePost(post) : null;
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
  
  return post ? serializePost(post) : null;
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

  return post ? serializePost(post) : null;
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
    const serializedPost = serializePost(post);

    if (serializedPost.date) {
      const year = dayjs(serializedPost.date).format('YYYY');
      if (!archivesMap.has(year)) {
        archivesMap.set(year, []);
      }
      archivesMap.get(year)?.push(serializedPost);
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

  // 处理 tags：确保是数组格式
  let tagsArray: string[] | null = null;
  if (data.tags) {
    if (Array.isArray(data.tags)) {
      const filteredTags = data.tags.filter(Boolean).map((tag: string) => String(tag).trim());
      tagsArray = filteredTags.length > 0 ? filteredTags : null;
    } else {
      throw new Error('tags must be an array');
    }
  }

  const postData: Partial<TbPost> = {
    title: data.title || null,
    category: data.category || null,
    tags: tagsArray,
    path,
    cover,
    layout: data.layout || null,
    content: data.content || null,
    description: data.description || undefined,
    date: data.date ? dayjs(data.date).format('YYYY-MM-DD HH:mm:ss') : now,
    updated: now,
    hide: data.hide || '0',
    is_delete: 0,
    visitors: 0,
    likes: 0,
  };

  const postRepository = await getPostRepository();
  const result = await postRepository.save(postData as TbPost);
  
  return serializePost(result);
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

  // 处理 tags：确保是数组格式
  if (data.tags !== undefined) {
    if (Array.isArray(data.tags)) {
      const filteredTags = data.tags.filter(Boolean).map((tag: string) => String(tag).trim());
      updateData.tags = filteredTags.length > 0 ? filteredTags : null;
    } else if (data.tags === null) {
      updateData.tags = null;
    } else {
      throw new Error('tags must be an array or null');
    }
  }

  // 如果有title，重新生成path
  if (data.title) {
     const date = data.date || now;
     updateData.path = genPath(data.title, date);
  }

  // 如果cover为空字符串，生成cover
  if (data.cover === '' || data.cover === null || data.cover === undefined) {
      const date = data.date || now;
      updateData.cover = genCover(date);
  }

  const postRepository = await getPostRepository();
  await postRepository.update(id, updateData);

  const updatedPost = await postRepository.findOne({
    where: { id },
  });

  return updatedPost ? serializePost(updatedPost) : null;
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
