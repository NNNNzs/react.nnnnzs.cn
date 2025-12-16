/**
 * 评论路由
 * 路由: /api/comment/[postId]
 * 获取指定文章的评论列表（从 GitHub Issues）
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { proxyFetch } from '@/lib/proxy-fetch';

interface RouteParams {
  params: Promise<{
    postId: string;
  }>;
}

/**
 * GET /api/comment/[postId]
 * 获取指定文章的评论列表
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { postId } = await params;
    const prisma = await getPrisma();
    
    // 获取文章信息
    const post = await prisma.tbPost.findUnique({
      where: { id: Number(postId) },
    });
    
    if (!post) {
      return NextResponse.json(
        errorResponse('文章不存在'),
        { status: 404 }
      );
    }
    
    // 如果文章还没有关联 GitHub Issue，返回空列表
    if (!post.github_issue_number) {
      return NextResponse.json(
        successResponse({
          comments: [],
          total: 0,
        })
      );
    }
    
    // 从 GitHub 获取评论列表
    const githubRepo = process.env.GITHUB_REPO; // 格式: owner/repo
    const githubToken = process.env.GITHUB_TOKEN; // 可选：用于私有仓库或更高额度
    
    if (!githubRepo) {
      return NextResponse.json(
        errorResponse('GitHub 仓库配置缺失'),
        { status: 500 }
      );
    }
    
    // 构造请求头（如果配置了 GITHUB_TOKEN，则携带认证信息，支持私有仓库）
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (githubToken) {
      console.log('githubToken', githubToken);
      headers.Authorization = `Bearer ${githubToken}`;
    }
    
    const response = await proxyFetch(
      `https://api.github.com/repos/${githubRepo}/issues/${post.github_issue_number}/comments`,
      {
        headers,
        next: { revalidate: 60 }, // 缓存 60 秒
      }
    );
    
    if (!response.ok) {
      console.error('获取 GitHub 评论失败:', await response.text());
      return NextResponse.json(
        errorResponse('获取评论失败'),
        { status: 500 }
      );
    }
    
    const comments = await response.json();
    
    // 格式化评论数据
    const formattedComments = comments.map((comment: {
      id: number;
      user: { login: string; avatar_url: string };
      body: string;
      created_at: string;
      updated_at: string;
      html_url: string;
    }) => ({
      id: comment.id,
      author: comment.user.login,
      avatar: comment.user.avatar_url,
      content: comment.body,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url,
    }));
    
    return NextResponse.json(
      successResponse({
        comments: formattedComments,
        total: formattedComments.length,
      })
    );
  } catch (error) {
    console.error('获取评论失败:', error);
    return NextResponse.json(
      errorResponse('获取评论失败'),
      { status: 500 }
    );
  }
}
