import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import type { QueryCondition, PageQueryRes, Archive } from '@/dto/post.dto';
import { TbPost } from '@/entities/post.entity';
import dayjs from 'dayjs';

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

  // 序列化日期对象，确保 tags 是数组，防止传递给客户端组件时报错
  const serializedData = data.map(post => {
    const processedPost = ensureTagsIsArray(post);
    return {
      ...processedPost,
      date: processedPost.date ? new Date(processedPost.date).toISOString() : null,
      updated: processedPost.updated ? new Date(processedPost.updated).toISOString() : null,
    };
  });

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
    // 确保 tags 是数组格式
    ensureTagsIsArray(post);
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
    // 确保 tags 是数组格式
    ensureTagsIsArray(post);
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
    // 确保 tags 是数组格式
    ensureTagsIsArray(post);
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
    // 确保 tags 是数组格式
    ensureTagsIsArray(post);
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

  // 处理 tags：如果是数组，转换为逗号分隔的字符串
  // TypeORM transformer 可能在某些情况下不会正确应用，所以手动转换
  let tagsValue: string | null = null;
  if (data.tags) {
    if (Array.isArray(data.tags)) {
      const filteredTags = data.tags.filter(Boolean).map(tag => String(tag).trim());
      tagsValue = filteredTags.length > 0 ? filteredTags.join(',') : null;
    } else if (typeof data.tags === 'string') {
      tagsValue = data.tags;
    }
  }

  // 清理不需要的字段，只保留实体需要的字段
  const { tagsString, ...cleanData } = data;

  // 创建明确的实体对象，确保所有字段类型正确
  const postData: Partial<TbPost> = {
    title: cleanData.title || null,
    category: cleanData.category || null,
    tags: tagsValue, // 已经是字符串类型
    path, // Use generated path
    cover, // Use generated/provided cover
    layout: cleanData.layout || null,
    content: cleanData.content || null,
    description: cleanData.description || null,
    date: data.date ? dayjs(data.date).format('YYYY-MM-DD HH:mm:ss') : now,
    updated: now,
    hide: data.hide || '0',
    is_delete: 0,
    visitors: 0,
    likes: 0,
  };

  // 最终检查：确保 tags 是字符串类型（防御性检查）
  if (postData.tags && Array.isArray(postData.tags)) {
    console.warn('⚠️ tags 仍然是数组，强制转换为字符串:', postData.tags);
    const filteredTags = postData.tags.filter(Boolean).map(tag => String(tag).trim());
    postData.tags = filteredTags.length > 0 ? filteredTags.join(',') : null;
  }

  const postRepository = await getPostRepository();
  const result = await postRepository.save(postData as TbPost);
  
  // 确保 tags 是数组格式并序列化
  const savedPost = ensureTagsIsArray({ ...result });
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

  // 处理 tags：如果是数组，转换为逗号分隔的字符串
  if (data.tags !== undefined) {
    if (Array.isArray(data.tags)) {
      const filteredTags = data.tags.filter(Boolean).map(tag => String(tag).trim());
      updateData.tags = filteredTags.length > 0 ? filteredTags.join(',') : null;
    } else if (typeof data.tags === 'string') {
      updateData.tags = data.tags;
    } else {
      updateData.tags = null;
    }
  }

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
      // 确保 tags 是数组格式
      ensureTagsIsArray(updatedPost);
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
