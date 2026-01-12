/**
 * 文章版本对比 API
 * GET /api/post/[id]/versions/diff - 获取两个版本之间的内容差异
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostVersion, getCurrentVersion } from '@/services/post-version';
import { getPostById } from '@/services/post';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取版本对比数据
 * Query params:
 * - from: 旧版本号（可选，默认为 to-1）
 * - to: 新版本号（可选，默认为当前最新版本）
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

    // 获取当前最新版本号
    const currentVersion = await getCurrentVersion(postId);
    if (currentVersion === 0) {
      return NextResponse.json(
        { status: false, message: '该文章没有版本记录', data: null },
        { status: 404 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const toParam = searchParams.get('to');
    const fromParam = searchParams.get('from');

    // 确定目标版本（to）
    const toVersion = toParam ? parseInt(toParam, 10) : currentVersion;
    if (isNaN(toVersion) || toVersion < 1 || toVersion > currentVersion) {
      return NextResponse.json(
        { status: false, message: '无效的目标版本号', data: null },
        { status: 400 }
      );
    }

    // 确定源版本（from）
    const fromVersion = fromParam ? parseInt(fromParam, 10) : Math.max(1, toVersion - 1);
    if (isNaN(fromVersion) || fromVersion < 0 || fromVersion > currentVersion) {
      return NextResponse.json(
        { status: false, message: '无效的源版本号', data: null },
        { status: 400 }
      );
    }

    // 获取两个版本的内容
    let oldContent = '';
    let newContent = '';

    if (fromVersion === 0) {
      // 与初始空内容对比
      oldContent = '';
    } else {
      const fromVersionData = await getPostVersion(postId, fromVersion);
      if (!fromVersionData) {
        return NextResponse.json(
          { status: false, message: `版本 ${fromVersion} 不存在`, data: null },
          { status: 404 }
        );
      }
      oldContent = fromVersionData.content;
    }

    const toVersionData = await getPostVersion(postId, toVersion);
    if (!toVersionData) {
      return NextResponse.json(
        { status: false, message: `版本 ${toVersion} 不存在`, data: null },
        { status: 404 }
      );
    }
    newContent = toVersionData.content;

    return NextResponse.json({
      status: true,
      message: '获取版本对比成功',
      data: {
        postId,
        postTitle: post.title,
        fromVersion,
        toVersion,
        oldContent,
        newContent,
        currentVersion,
      },
    });
  } catch (error) {
    console.error('获取版本对比失败:', error);
    return NextResponse.json(
      {
        status: false,
        message: error instanceof Error ? error.message : '获取版本对比失败',
        data: null,
      },
      { status: 500 }
    );
  }
}
