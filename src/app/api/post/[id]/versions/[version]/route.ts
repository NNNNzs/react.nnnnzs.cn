/**
 * 文章版本详情和回滚 API
 * GET /api/post/[id]/versions/[version] - 获取指定版本内容
 * POST /api/post/[id]/versions/[version]/rollback - 回滚到指定版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostVersion } from '@/services/post-version';
import { getAuthUserFromRequest } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPostByIdIncludingDeleted } from '@/services/post';
import { canViewPost } from '@/lib/permission';

/**
 * 获取指定版本的内容
 */
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; version: string }>;
  }
) {
  try {
    const { id, version } = await context.params;
    const postId = Number(id);
    const versionNum = Number(version);

    if (isNaN(postId) || isNaN(versionNum)) {
      return NextResponse.json(errorResponse('无效的参数'), { status: 400 });
    }

    const post = await getPostByIdIncludingDeleted(postId);
    if (!post) {
      return NextResponse.json(errorResponse('文章不存在'), { status: 404 });
    }
    const user = await getAuthUserFromRequest(request.headers);
    if (!canViewPost(user, post)) {
      return NextResponse.json(errorResponse('无权限查看此文章的版本记录'), { status: 403 });
    }

    const versionRecord = await getPostVersion(postId, versionNum);
    if (!versionRecord) {
      return NextResponse.json(errorResponse('版本不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(versionRecord), {
      headers: post.hide === '1' || post.is_delete !== 0
        ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
        : undefined,
    });
  } catch (error) {
    console.error('获取文章版本详情失败:', error);
    return NextResponse.json(errorResponse('获取文章版本详情失败'), {
      status: 500,
    });
  }
}
