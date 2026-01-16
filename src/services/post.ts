import { getPrisma } from '@/lib/prisma';
import type { QueryCondition, PageQueryRes, Archive, SerializedPost } from '@/dto/post.dto';
import { TbPost } from '@/generated/prisma-client';
import dayjs from 'dayjs';
import { createPostVersion } from '@/services/post-version';
import { incrementalEmbedPost } from '@/services/embedding';
import { revalidatePath } from "next/cache";

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
 * 将 Prisma 实体序列化为纯对象
 *
 * 说明：
 * - tags: 手动将数据库字符串 'tag1,tag2,tag3' 转换为数组 ['tag1', 'tag2', 'tag3']
 * - date/updated: 转换为 ISO 字符串格式，便于 JSON 序列化
 */
export function serializePost(post: TbPost): SerializedPost {
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
  
  const prisma = await getPrisma();

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {
    is_delete: 0,
  };

  if (hide !== 'all') {
    whereConditions.hide = hide;
  }

  if (query) {
    whereConditions.OR = [
      { content: { contains: query } },
      { title: { contains: query } }
    ];
  }

  // 查询数据
  const [data, count] = await Promise.all([
    prisma.tbPost.findMany({
      where: whereConditions,
      orderBy: {
        date: 'desc',
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
        created_by: true,
        // content 不在列表中返回
        content: false,
        is_delete: false,
      },
    }),
    prisma.tbPost.count({ where: whereConditions }),
  ]);

  // 序列化日期对象并确保 tags 是数组格式
  const serializedData = data.map(post => serializePost(post as TbPost));

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
  console.log('🔍 获取文章详情 - 路径:', path);
  const prisma = await getPrisma();
  const post = await prisma.tbPost.findFirst({
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
  const prisma = await getPrisma();
  const post = await prisma.tbPost.findFirst({
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
  const prisma = await getPrisma();
  const post = await prisma.tbPost.findUnique({
    where: {
      id,
    },
  });

  // 检查是否已删除
  if (post && post.is_delete !== 0) {
    return null;
  }

  return post ? serializePost(post) : null;
}

/**
 * 获取归档数据
 * 
 * 注意：查询所有字段以满足 SerializedPost 类型要求
 * 虽然归档页面可能只需要部分字段，但保持类型一致性很重要
 */
export async function getArchives(): Promise<Archive[]> {
  const prisma = await getPrisma();
  const posts = await prisma.tbPost.findMany({
    where: {
      hide: '0',
      is_delete: 0,
    },
    orderBy: {
      date: 'desc',
    },
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
 * - date/updated: 接收 Date 对象
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

  const prisma = await getPrisma();
  
  // 创建文章
  const result = await prisma.tbPost.create({
    data: {
      title: data.title || null,
      category: data.category || null,
      tags: tagsString,
      path,
      cover,
      layout: data.layout || null,
      content: data.content || '', // content 字段不允许为 null
      description: data.description || null,
      date: dateValue,
      updated: now,
      hide: data.hide || '0',
      is_delete: 0,
      visitors: 0,
      likes: 0,
      // 创建人：允许上层传入，默认为空
      created_by: data.created_by ?? null,
    },
  });
  
  return serializePost(result);
}

/**
 * 更新文章
 *
 * 说明：
 * - tags: 接收数组或字符串，手动转换为逗号分隔的字符串存储
 * - date: 接收 Date 对象
 * - createdBy: 创建人ID（可选，用于版本管理）
 */
export async function updatePost(
  id: number,
  data: Partial<TbPost>,
  createdBy?: number
): Promise<SerializedPost | null> {
  const prisma = await getPrisma();
  const now = new Date();

  // 先获取原文章数据，用于获取原始发布日期
  const existingPost = await prisma.tbPost.findUnique({
    where: { id },
  });

  if (!existingPost) {
    return null;
  }

  const updateData: Record<string, unknown> = {
    updated: now,
  };

  // 检查内容是否有更新
  const hasContentUpdate = data.content !== undefined && data.content !== existingPost.content;

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

  // 如果有 title，重新生成 path（使用原始发布日期或更新后的日期）
  if (data.title) {
    // 优先使用更新的日期，否则使用原文章的日期
    const dateForPath = (updateData.date as Date) || existingPost.date;
    updateData.path = genPath(data.title, dateForPath);
    updateData.title = data.title;
  }

  // 如果 cover 为空，生成新的 cover（使用原始发布日期或更新后的日期）
  if (data.cover === '' || data.cover === null || data.cover === undefined) {
    const dateForCover = (updateData.date as Date) || existingPost.date;
    updateData.cover = genCover(dateForCover);
  } else if (data.cover) {
    updateData.cover = data.cover;
  }

  // 添加其他字段
  if (data.category !== undefined) updateData.category = data.category;
  if (data.layout !== undefined) updateData.layout = data.layout;
  if (data.content !== undefined) {
    updateData.content = data.content;
  } else {
  }
  if (data.description !== undefined) updateData.description = data.description;
  if (data.hide !== undefined) updateData.hide = data.hide;
  if (data.visitors !== undefined) updateData.visitors = data.visitors;
  if (data.likes !== undefined) updateData.likes = data.likes;


  const updatedPost = await prisma.tbPost.update({
    where: { id },
    data: updateData,
  });

  revalidatePath(updatedPost.path!);

  // 如果内容有更新，创建版本记录并执行增量向量化（异步执行，不阻塞响应）
  if (hasContentUpdate && updatedPost.content) {
    // 异步执行，不阻塞响应
    (async () => {
      try {
        // 先创建版本记录
        const version = await createPostVersion(id, updatedPost.content!, createdBy);
        
        // 然后执行增量向量化（创建chunk记录）
        await incrementalEmbedPost({
          postId: id,
          title: updatedPost.title || '',
          content: updatedPost.content || '',
          version: version.version,
          hide: updatedPost.hide || '0',
        });

      } catch (error) {
        console.error(`❌ 文章 ${id} 版本记录或增量向量化失败:`, error);
        // 失败不影响文章更新
      }
    })();
  }

  return serializePost(updatedPost);
}

/**
 * 删除文章
 */
export async function deletePost(id: number): Promise<boolean> {
  const prisma = await getPrisma();
  const result = await prisma.tbPost.update({
    where: { id },
    data: {
      is_delete: 1,
    },
  });
  return !!result;
}
