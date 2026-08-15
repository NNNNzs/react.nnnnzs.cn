/**
 * 博客文章详情API
 * GET /api/post/[id]
 * PUT /api/post/[id]
 * PATCH /api/post/[id]
 * DELETE /api/post/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPostById, getPostByIdIncludingDeleted, getPostByTitle, updatePost, deletePost } from '@/services/post';
import { getAuthUserFromRequest } from '@/lib/auth';
import { canViewPost, requirePermission, hasDataPermission } from '@/lib/permission';
import { POST_VIEW, POST_EDIT, POST_DELETE } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import type { ApiDescriptor } from '@/types/api-descriptor';
import { getCollectionsByPostId } from '@/services/collection';
import { collectPostCacheImpact } from '@/lib/cache-impact';
import { scheduleCacheImpact } from '@/services/cache-refresh';
import { bestEffortCacheRead } from '@/services/cache-impact-snapshot';

/** 获取文章详情接口描述 */
export const getDescriptor: ApiDescriptor = {
  code: 'post_get',
  name: '获取文章',
  module: 'post',
  method: 'GET',
  permissionCode: POST_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: '文章ID' },
      title: { type: 'string', description: '文章标题（ID和标题二选一）' },
    },
  },
};

/** 更新文章接口描述 */
export const updateDescriptor: ApiDescriptor = {
  code: 'post_update',
  name: '更新文章',
  description: '更新博客文章。大幅改写正文前建议先从 MCP Prompts 选择并应用对应写作规范。',
  module: 'post',
  method: 'PUT',
  permissionCode: POST_EDIT,
  cacheTags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: '文章ID' },
      title: { type: 'string', description: '文章标题' },
      content: { type: 'string', description: '文章内容（Markdown）' },
      category: { type: 'string', description: '分类' },
      tags: { type: 'string', description: '逗号分隔的标签' },
      description: { type: 'string', description: '简短描述' },
      cover: { type: 'string', description: '封面图URL' },
      hide: { type: 'string', description: '1隐藏 0显示' },
      seo_indexable: { type: 'boolean', description: '是否允许搜索引擎索引' },
      add_to_collections: { type: 'string', description: '添加到的合集ID或slug，逗号分隔' },
      remove_from_collections: { type: 'string', description: '移除的合集ID或slug，逗号分隔' },
    },
    required: ['id'],
  },
};

/** 删除文章接口描述 */
export const deleteDescriptor: ApiDescriptor = {
  code: 'post_delete',
  name: '删除文章',
  module: 'post',
  method: 'DELETE',
  permissionCode: POST_DELETE,
  cacheTags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: '文章ID' },
    },
    required: ['id'],
  },
};
// 定义文章更新的验证schema
const updatePostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200个字符').optional(),
  content: z.string().min(1, '内容不能为空').optional(),
  category: z.string().optional().nullable(),
  tags: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional().nullable(),
  description: z.string().max(500, '描述不能超过500个字符').optional().nullable(),
  cover: z.string().optional().nullable(),
  layout: z.string().optional().nullable(),
  date: z.union([
    z.string().transform(str => new Date(str)),
    z.date(),
  ]).optional().nullable(),
  hide: z.enum(['0', '1']).optional(),
  seo_indexable: z.boolean().optional(),
  visitors: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
});

/**
 * 获取文章详情
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 判断是ID还是标题
    let post;
    if (isNaN(Number(id))) {
      // 是标题
      const decodedTitle = decodeURIComponent(id);
      post = await getPostByTitle(decodedTitle);
    } else {
      // 是ID
      post = await getPostByIdIncludingDeleted(Number(id));
    }

    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    const user = await getAuthUserFromRequest(request.headers);
    if (!canViewPost(user, post)) {
      return NextResponse.json(
        errorResponse(post.is_delete !== 0 ? '无权限查看已删除文章' : '无权限查看此隐藏文章'),
        { status: 403 },
      );
    }

    return NextResponse.json(successResponse(post), {
      // 隐藏/回收站内容绝不能被浏览器、中间代理或 CDN 复用给其他请求者。
      headers: post.hide === '1' || post.is_delete !== 0
        ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
        : undefined,
    });
  } catch (error) {
    console.error('获取文章详情失败:', error);
    return NextResponse.json(errorResponse('获取文章详情失败'), {
      status: 500,
    });
  }
}

/**
 * 更新文章
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, POST_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await context.params;
    const postId = Number(id);

    // 先获取文章，检查数据权限
    const existingPost = await getPostByIdIncludingDeleted(postId);
    if (!existingPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 检查数据权限
    if (!hasDataPermission(user, POST_EDIT, existingPost.created_by)) {
      return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
    }
    const shouldRefreshPublicState = existingPost.is_delete === 0;
    const beforeCollections = shouldRefreshPublicState
      ? await bestEffortCacheRead(
        `post:${postId}:before-collections`,
        () => getCollectionsByPostId(postId),
        [],
      )
      : [];

    const body = await request.json();

    // 使用Zod验证输入
    const validationResult = updatePostSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const updatedPost = await updatePost(
      postId,
      validationResult.data as Partial<import('@/generated/prisma-client/client').TbPost>,
      user.id
    );

    if (!updatedPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    if (shouldRefreshPublicState) {
      const afterCollections = await bestEffortCacheRead(
        `post:${postId}:after-collections`,
        () => getCollectionsByPostId(postId),
        [],
      );
      scheduleCacheImpact(collectPostCacheImpact({
        kind: 'update',
        before: existingPost,
        after: updatedPost,
        beforeCollections,
        afterCollections,
        changedFields: Object.keys(validationResult.data),
      }));
    }

    // 注意：向量化现在在 updatePost 函数中通过增量向量化处理（创建版本和chunk记录）
    // 这里不再需要单独调用 embedPost

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('更新文章失败:', error);
    return NextResponse.json(errorResponse('更新文章失败'), { status: 500 });
  }
}

/**
 * 部分更新文章
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, POST_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await context.params;
    const postId = Number(id);

    // 先获取文章，检查数据权限
    const existingPost = await getPostByIdIncludingDeleted(postId);
    if (!existingPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 检查数据权限
    if (!hasDataPermission(user, POST_EDIT, existingPost.created_by)) {
      return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
    }
    const shouldRefreshPublicState = existingPost.is_delete === 0;
    const beforeCollections = shouldRefreshPublicState
      ? await bestEffortCacheRead(
        `post:${postId}:before-collections`,
        () => getCollectionsByPostId(postId),
        [],
      )
      : [];

    const body = await request.json();

    // 检查是否有要更新的字段
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        errorResponse('请求体不能为空，至少需要提供一个要更新的字段'),
        { status: 400 }
      );
    }

    // 使用Zod验证输入（允许部分字段）
    const validationResult = updatePostSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const updatedPost = await updatePost(
      postId,
      validationResult.data as Partial<import('@/generated/prisma-client/client').TbPost>,
      user.id
    );

    if (!updatedPost) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    if (shouldRefreshPublicState) {
      const afterCollections = await bestEffortCacheRead(
        `post:${postId}:after-collections`,
        () => getCollectionsByPostId(postId),
        [],
      );
      scheduleCacheImpact(collectPostCacheImpact({
        kind: 'update',
        before: existingPost,
        after: updatedPost,
        beforeCollections,
        afterCollections,
        changedFields: Object.keys(validationResult.data),
      }));
    }

    // 注意：向量化现在在 updatePost 函数中通过增量向量化处理（创建版本和chunk记录）
    // 这里不再需要单独调用 embedPost

    return NextResponse.json(successResponse(updatedPost));
  } catch (error) {
    console.error('部分更新文章失败:', error);
    return NextResponse.json(errorResponse('部分更新文章失败'), { status: 500 });
  }
}

/**
 * 删除文章（软删除）
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, POST_DELETE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }
    const { user } = check;

    const { id } = await context.params;
    const postId = Number(id);

    // 先获取文章信息用于清除缓存和数据权限检查
    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    // 检查数据权限
    if (!hasDataPermission(user, POST_DELETE, post.created_by)) {
      return NextResponse.json(errorResponse('无权限删除此文章'), { status: 403 });
    }
    const beforeCollections = await bestEffortCacheRead(
      `post:${postId}:before-delete-collections`,
      () => getCollectionsByPostId(postId),
      [],
    );

    const success = await deletePost(postId);

    if (!success) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }

    scheduleCacheImpact(collectPostCacheImpact({
      kind: 'delete',
      before: post,
      after: null,
      beforeCollections,
    }));

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除文章失败:', error);
    return NextResponse.json(errorResponse('删除文章失败'), { status: 500 });
  }
}
