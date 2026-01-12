/**
 * 文章版本历史 API
 * GET /api/post/[id]/versions - 获取文章的所有版本列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostVersions, getPostVersion } from '@/services/post-version';
import { getPostById } from '@/services/post';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取文章版本列表
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json(
        { status: false, message: '无效的文章ID', data: null },
        { status: 400 }
      );
    }

    // 检查文章是否存在
    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json(
        { status: false, message: '文章不存在', data: null },
        { status: 404 }
      );
    }

    // 获取版本参数（可选，用于获取特定版本的完整内容）
    const { searchParams } = new URL(request.url);
    const versionParam = searchParams.get('version');

    if (versionParam) {
      // 获取特定版本的完整内容
      const version = parseInt(versionParam, 10);
      if (isNaN(version)) {
        return NextResponse.json(
          { status: false, message: '无效的版本号', data: null },
          { status: 400 }
        );
      }

      const versionData = await getPostVersion(postId, version);
      if (!versionData) {
        return NextResponse.json(
          { status: false, message: '版本不存在', data: null },
          { status: 404 }
        );
      }

      return NextResponse.json({
        status: true,
        message: '获取版本成功',
        data: {
          id: versionData.id,
          postId: versionData.post_id,
          version: versionData.version,
          content: versionData.content,
          createdAt: versionData.created_at.toISOString(),
          createdBy: versionData.created_by,
        },
      });
    }

    // 获取版本列表（不包含完整内容）
    const versions = await getPostVersions(postId);

    const versionList = versions.map((v) => ({
      id: v.id,
      postId: v.post_id,
      version: v.version,
      createdAt: v.created_at.toISOString(),
      createdBy: v.created_by,
      // 不返回完整内容，只返回内容长度
      contentLength: v.content?.length || 0,
    }));

    return NextResponse.json({
      status: true,
      message: '获取版本列表成功',
      data: {
        postId,
        postTitle: post.title,
        versions: versionList,
        total: versionList.length,
      },
    });
  } catch (error) {
    console.error('获取版本列表失败:', error);
    return NextResponse.json(
      {
        status: false,
        message: error instanceof Error ? error.message : '获取版本列表失败',
        data: null,
      },
      { status: 500 }
    );
  }
}
