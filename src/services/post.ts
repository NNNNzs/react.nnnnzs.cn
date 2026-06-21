import { getPrisma } from '@/lib/prisma';
import type { QueryCondition, PageQueryRes, Archive, SerializedPost } from '@/dto/post.dto';
import { TbPost } from '@/generated/prisma-client';
import dayjs from 'dayjs';
import { createPostVersion } from '@/services/post-version';
import { queueEmbedPost } from '@/services/embedding';
import { revalidatePath } from "next/cache";
import { detectChanges } from '@/services/entity-change-detector';
import { createChangeLogs } from '@/services/entity-change-log';
import { EntityType } from '@/types/entity-change';

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
 * 获取公开且未删除的文章总数
 */
export async function getPublicPostCount(): Promise<number> {
  const prisma = await getPrisma();

  return prisma.tbPost.count({
    where: {
      hide: '0',
      is_delete: 0,
    },
  });
}

/**
 * 生成 URL 安全的 slug
 *
 * 参考 RFC3986:
 * - 非保留字符: a-z A-Z 0-9 - . _ ~ (无需编码)
 * - 保留字符有特殊含义，在 slug 中应避免
 *
 * 转换规则:
 * - 空格 → -
 * - + → -
 * - 其他保留字符 (#, ?, /, &, = 等) → -
 * - 多个连续 - → 单个 -
 * - 首尾 - → 去除
 */
function generateSlug(title: string): string {
  return title
    .trim()
    // 空格和特殊字符替换为连字符
    .replace(/[\s+#?/&=,;!$'()*\[\]@]+/g, '-')
    // 中文标点替换为连字符
    .replace(/[，；！？：""''（）【】《》]+/g, '-')
    // 冒号替换为连字符（中文冒号和英文冒号）
    .replace(/[:：]+/g, '-')
    // 多个连字符合并为单个
    .replace(/-+/g, '-')
    // 去除首尾连字符
    .replace(/^-+|-+$/g, '');
}

/**
 * 生成文章路径
 */
function genPath(title: string, date: Date | string): string {
  const dateObj = dayjs(date);
  const year = dateObj.format('YYYY');
  const month = dateObj.format('MM');
  const day = dateObj.format('DD');
  const slug = generateSlug(title);
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
  const { pageNum = 1, pageSize = 10, hide = '0', query = '', created_by, is_delete } = params;

  const prisma = await getPrisma();

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  // is_delete 参数：明确指定时使用指定值，否则默认为 0（未删除）
  if (is_delete !== undefined) {
    whereConditions.is_delete = is_delete;
  } else {
    whereConditions.is_delete = 0;
  }

  if (hide !== 'all') {
    whereConditions.hide = hide;
  }

  // 按创建者过滤
  if (created_by !== undefined) {
    whereConditions.created_by = created_by;
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
        rag_status: true,
        rag_error: true,
        rag_updated_at: true,
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
      hide: '0', // 只查询显示的文章
    },
  });

  if (!post) {
    // 如果直接查询失败，尝试解码路径后再次查询
    // 这是因为 Next.js 传递的 URL 参数可能是编码的
    const decodedPath = decodeURI(path);
    console.log('🔍 第一次查询失败，尝试解码后的路径:', decodedPath);

    const decodedPost = await prisma.tbPost.findFirst({
      where: {
        path: decodedPath,
        is_delete: 0,
        hide: '0', // 只查询显示的文章
      },
    });

    return decodedPost ? serializePost(decodedPost) : null;
  }

  return serializePost(post);
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
      // RAG 状态初始化
      rag_status: 'pending',
      rag_error: null,
    },
  });

  const changes = detectChanges(EntityType.POST, {}, result as unknown as Record<string, unknown>);
  if (changes.length > 0) {
    await createChangeLogs({
      entityId: result.id,
      entityType: EntityType.POST,
      changes,
      userId: data.created_by ?? undefined,
    });
  }

  if (result.content) {
    await createPostVersion(result.id, result.content, data.created_by ?? undefined);
  }

  // 异步添加到向量化队列（不阻塞响应）
  if (result.content) {
    (async () => {
      try {
        await queueEmbedPost({
          postId: result.id,
          title: result.title || '',
          content: result.content,
          hide: result.hide || '0',
          priority: 5, // 新文章优先级略高
        });
      } catch (error) {
        console.error(`❌ 添加文章 ${result.id} 到向量化队列失败:`, error);
      }
    })();
  }

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
    const newDate = new Date(data.date);
    updateData.date = newDate;

    // 调试日志：比较日期
    const oldDate = existingPost.date;
    console.log('📅 日期变更检测:', {
      oldDate: oldDate?.toISOString(),
      newDate: newDate.toISOString(),
      oldTimestamp: oldDate ? Math.floor(oldDate.getTime() / 1000) : null,
      newTimestamp: Math.floor(newDate.getTime() / 1000),
      isChanged: oldDate ? Math.floor(oldDate.getTime() / 1000) !== Math.floor(newDate.getTime() / 1000) : 'no old date',
    });
  }

  // 如果有 title，重新生成 path（使用原始发布日期或更新后的日期）
  if (data.title) {
    // 优先使用更新的日期，否则使用原文章的日期
    const dateForPath = (updateData.date as Date) || existingPost.date;
    updateData.path = genPath(data.title, dateForPath);
    updateData.title = data.title;
  }

  // 处理 cover 字段
  // - undefined: 不传该字段，不更新 cover（保持原值）
  // - null 或空字符串: 自动生成 cover
  // - 具体值: 使用该值
  if (data.cover !== undefined) {
    if (data.cover === '' || data.cover === null) {
      // 显式设置为空时，自动生成
      const dateForCover = (updateData.date as Date) || existingPost.date;
      updateData.cover = genCover(dateForCover);
    } else {
      // 使用传入的值
      updateData.cover = data.cover;
    }
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

  // 检测字段变更并记录日志，确保 MCP/HTTP 请求返回前日志已落库
  const changes = detectChanges(
    EntityType.POST,
    existingPost,
    updateData
  );

  // 调试日志：显示检测到的变更
  console.log('🔍 检测到字段变更:', {
    totalChanges: changes.length,
    changes: changes.map(c => ({
      field: c.fieldName,
      display: c.displayName,
      oldValue: c.oldValue,
      newValue: c.newValue,
    })),
    updateDataKeys: Object.keys(updateData),
  });

  if (changes.length > 0) {
    await createChangeLogs({
      entityId: id,
      entityType: EntityType.POST,
      changes,
      userId: createdBy,
    });
  }

  // 如果内容有更新，先确保版本记录落库，再异步添加到向量化队列
  if (hasContentUpdate && updatedPost.content) {
    await createPostVersion(id, updatedPost.content, createdBy);

    // 异步执行，不阻塞响应
    (async () => {
      try {
        // 添加到向量化队列（使用新的简化向量化服务）
        await queueEmbedPost({
          postId: id,
          title: updatedPost.title || '',
          content: updatedPost.content || '',
          hide: updatedPost.hide || '0',
          priority: 5, // 更新文章优先级略高
        });

      } catch (error) {
        console.error(`❌ 文章 ${id} 添加到向量化队列失败:`, error);
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

  // 异步删除向量数据（不阻塞响应）
  if (result) {
    (async () => {
      try {
        const { removePostEmbeddings } = await import('@/services/embedding');
        await removePostEmbeddings(id);
      } catch (error) {
        console.error(`❌ 删除文章 ${id} 的向量数据失败:`, error);
      }
    })();
  }

  return !!result;
}
