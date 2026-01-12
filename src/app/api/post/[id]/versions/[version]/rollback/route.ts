/**
 * 回滚到指定版本 API
 * POST /api/post/[id]/versions/[version]/rollback
 */

import { NextRequest, NextResponse } from 'next/server';
import { rollbackToVersion } from '@/services/post-version';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { updatePost } from '@/services/post';

/**
 * 回滚到指定版本
 */
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; version: string }>;
  }
) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const { id, version } = await context.params;
    const postId = Number(id);
    const versionNum = Number(version);

    if (isNaN(postId) || isNaN(versionNum)) {
      return NextResponse.json(errorResponse('无效的参数'), { status: 400 });
    }

    // 回滚到指定版本（创建新版本）
    const newVersion = await rollbackToVersion(postId, versionNum, user.id);

    // 更新文章内容为回滚后的内容
    await updatePost(postId, {
      content: newVersion.content,
    });

    return NextResponse.json(
      successResponse(newVersion, '回滚成功，已创建新版本')
    );
  } catch (error) {
    console.error('回滚版本失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '回滚版本失败';
    return NextResponse.json(errorResponse(errorMessage), {
      status: 500,
    });
  }
}
