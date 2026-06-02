/**
 * 博客文章列表API
 * GET /api/post/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostList } from '@/services/post';
import { successResponse, errorResponse } from '@/dto/response.dto';
import type { QueryCondition } from '@/dto/post.dto';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasPermissionCode } from '@/lib/permission';
import { POST_VIEW, POST_VIEW_DELETED } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'post_list',
  name: '文章列表',
  module: 'post',
  method: 'GET',
  permissionCode: POST_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码（默认1）' },
      pageSize: { type: 'number', description: '每页数量（默认10）' },
      keyword: { type: 'string', description: '搜索关键词' },
      hide: { type: 'string', description: '可见性过滤' },
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageNum = Number(searchParams.get('pageNum')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 10;
    const hide = searchParams.get('hide') || '0';
    const query = searchParams.get('query') || '';
    const createdBy = searchParams.get('created_by');
    const isDelete = searchParams.get('is_delete'); // 是否包含已删除文章

    // 获取用户信息（可能为空）
    const user = await getAuthUserFromRequest(request.headers);

    // is_delete=1 只有管理员可以查询
    if (isDelete === '1') {
      if (!user || !hasPermissionCode(user, POST_VIEW_DELETED)) {
        return NextResponse.json(
          errorResponse('无权限查看已删除文章'),
          { status: 403 }
        );
      }
    }

    // hide=all 需要管理员权限（查看所有人的隐藏文章）
    if (hide === 'all') {
      if (!user || !hasPermissionCode(user, POST_VIEW_DELETED)) {
        return NextResponse.json(
          errorResponse('无权限查看所有隐藏文章'),
          { status: 403 }
        );
      }
    }

    // hide=1 时，非管理员只能查看自己的隐藏文章
    if (hide === '1') {
      if (!user) {
        return NextResponse.json(errorResponse('未授权'), { status: 401 });
      }

      // 如果没有指定 created_by，或者不是查自己的文章，则需要管理员权限
      if (!createdBy || parseInt(createdBy, 10) !== user.id) {
        if (!hasPermissionCode(user, POST_VIEW_DELETED)) {
          return NextResponse.json(
            errorResponse('无权限查看其他用户的隐藏文章'),
            { status: 403 }
          );
        }
      }
    }

    const params: QueryCondition = {
      pageNum,
      pageSize,
      hide,
      query,
    };

    // 按用户过滤
    if (createdBy) {
      // 如果指定了 created_by，检查权限
      if (!user) {
        return NextResponse.json(errorResponse('未授权'), { status: 401 });
      }

      const createdByNum = parseInt(createdBy, 10);

      // 非管理员只能查询自己的文章
      if (user.id !== createdByNum && !hasPermissionCode(user, POST_VIEW_DELETED)) {
        return NextResponse.json(
          errorResponse('无权限查看其他用户的文章'),
          { status: 403 }
        );
      }

      params.created_by = createdByNum;
    }

    // 是否包含已删除文章（只有管理员可以查询）
    if (isDelete === '1' && user && hasPermissionCode(user, POST_VIEW_DELETED)) {
      params.is_delete = 1;
    }

    const result = await getPostList(params);

    return NextResponse.json(
      successResponse(result)
    );
  } catch (error) {
    console.error('获取文章列表失败:', error);
    return NextResponse.json(errorResponse('获取文章列表失败'), {
      status: 500,
    });
  }
}
