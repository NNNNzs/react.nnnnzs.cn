import { Like } from 'typeorm';
import { getPostRepository } from '@/lib/repositories';
import type { QueryCondition, PageQueryRes, Archive, SerializedPost } from '@/dto/post.dto';
import { TbPost } from '@/entities/post.entity';
import dayjs from 'dayjs';

/**
 * 将字符串标签转换为数组
 * @param tags 数据库中的标签字符串 'tag1,tag2,tag3'
 * @returns 标签数组 ['tag1', 'tag2', 'tag3']
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
 * 将 TypeORM 实体序列化为纯对象
 * 
 * 说明：
 * - tags: 手动将数据库字符串 'tag1,tag2,tag3' 转换为数组 ['tag1', 'tag2', 'tag3']
 * - date/updated: 转换为 ISO 字符串格式，便于 JSON 序列化
 */
function serializePost(post: TbPost): SerializedPost {
  return {
    ...post,
    // 手动将字符串转换为数组
    tags: parseTagsString(post.tags),
    // 日期字段转换为 ISO 字符串
    date: post.date ? new Date(post.date).toISOString() : null,
    updated: post.updated ? new Date(post.updated).toISOString() : null,
  };
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
export async function getPostList(params: QueryCondition): Promise<PageQueryRes<SerializedPost>> {
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
    record: serializedData,
    total: count,
    pageNum,
    pageSize,
  };
}

/**
 * 根据路径获取文章
 */
export async function getPostByPath(path: string): Promise<SerializedPost | null> {
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
export async function getPostByTitle(title: string): Promise<SerializedPost | null> {
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
export async function getPostById(id: number): Promise<SerializedPost | null> {
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
  const archivesMap = new Map<string, SerializedPost[]>();
  
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
 * 
 * 说明：
 * - tags: 接收数组或字符串，手动转换为逗号分隔的字符串存储
 * - date/updated: 接收 Date 对象，TypeORM 会自动转换为 MySQL datetime 格式
 * - MySQL 5.7 datetime 不支持毫秒，TypeORM 会自动截断
 */
export async function createPost(data: Partial<TbPost>): Promise<SerializedPost> {
  const now = new Date();
  
  // 处理日期：统一转换为 Date 对象
  const dateValue = data.date ? new Date(data.date) : now;
  
  // 生成 path
  const path = genPath(data.title || '', dateValue);
  
  // 生成或使用提供的 cover
  const cover = data.cover || genCover(dateValue);

  // 处理 tags: 手动转换为逗号分隔的字符串
  // 输入: ['tag1', 'tag2'] 或 'tag1,tag2'
  // 输出: 'tag1,tag2' (存储到数据库)
  let tagsString: string | null = null;
  if (data.tags !== undefined && data.tags !== null) {
    // 类型守卫：允许运行时接收 string 或 string[]
    const rawTags = data.tags as string | string[];
    if (Array.isArray(rawTags)) {
      // 数组 → 字符串
      const filteredTags = rawTags
        .filter(Boolean)
        .map((tag: string) => String(tag).trim())
        .filter(Boolean);
      tagsString = filteredTags.length > 0 ? filteredTags.join(',') : null;
    } else if (typeof rawTags === 'string') {
      // 字符串 → 清理后的字符串
      tagsString = rawTags.trim() || null;
    } else {
      throw new Error('tags must be an array or string');
    }
  }

  // 构建文章数据对象
  const postData: Partial<TbPost> = {
    title: data.title || null,
    category: data.category || null,
    // tags 存储字符串格式到数据库
    tags: tagsString,
    path,
    cover,
    layout: data.layout || null,
    content: data.content || null,
    description: data.description || null,
    date: dateValue,
    updated: now,
    hide: data.hide || '0',
    is_delete: 0,
    visitors: 0,
    likes: 0,
  };
  
  const postRepository = await getPostRepository();
  
  // create() 创建实体实例
  const postEntity = postRepository.create(postData);
  
  // save() 保存时，transformer 的 from 方法会将数组转换为字符串
  const result = await postRepository.save(postEntity);
  
  return serializePost(result);
}

/**
 * 更新文章
 * 
 * 说明：
 * - tags: 接收数组或字符串，手动转换为逗号分隔的字符串存储
 * - date: 接收 Date 对象，TypeORM 会自动处理格式转换
 */
export async function updatePost(id: number, data: Partial<TbPost>): Promise<SerializedPost | null> {
  const now = new Date();
  
  const updateData: Partial<TbPost> = {
    ...data,
    updated: now,
  };

  // 处理 tags: 手动转换为字符串格式
  if (data.tags !== undefined) {
    if (data.tags === null) {
      updateData.tags = null;
    } else {
      const rawTags = data.tags as string | string[];
      if (Array.isArray(rawTags)) {
        // 数组 → 字符串
        const filteredTags = rawTags
          .filter(Boolean)
          .map((tag: string) => String(tag).trim())
          .filter(Boolean);
        updateData.tags = filteredTags.length > 0 ? filteredTags.join(',') : null;
      } else if (typeof rawTags === 'string') {
        // 字符串 → 清理后的字符串
        updateData.tags = rawTags.trim() || null;
      } else {
        throw new Error('tags must be an array, string, or null');
      }
    }
  }

  // 处理日期：统一转换为 Date 对象
  if (data.date !== undefined && data.date !== null) {
    updateData.date = new Date(data.date);
  }

  // 如果有 title，重新生成 path
  if (data.title) {
    const dateForPath = updateData.date || now;
    updateData.path = genPath(data.title, dateForPath);
  }

  // 如果 cover 为空，生成新的 cover
  if (data.cover === '' || data.cover === null || data.cover === undefined) {
    const dateForCover = updateData.date || now;
    updateData.cover = genCover(dateForCover);
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
