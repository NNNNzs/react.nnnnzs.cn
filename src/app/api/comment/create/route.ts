/**
 * 创建评论路由
 * 路由: /api/comment/create
 * 创建评论（在 GitHub Issues 中）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { proxyFetch } from '@/lib/proxy-fetch';

/**
 * 创建 GitHub Issue
 */
async function createGithubIssue(
  accessToken: string,
  repo: string,
  title: string,
  body: string
) {
  const response = await proxyFetch(
    `https://api.github.com/repos/${repo}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels: ['comment'],
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('创建 GitHub Issue 失败:', error);
    throw new Error('创建 GitHub Issue 失败');
  }
  
  return response.json();
}

/**
 * 在 GitHub Issue 中添加评论
 */
async function addGithubComment(
  accessToken: string,
  repo: string,
  issueNumber: number,
  body: string
) {
  const response = await proxyFetch(
    `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('添加 GitHub 评论失败:', error);
    throw new Error('添加 GitHub 评论失败');
  }
  
  return response.json();
}

/**
 * POST /api/comment/create
 * 创建评论
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        errorResponse('未登录或登录已过期'),
        { status: 401 }
      );
    }
    
    // 解析请求参数
    const body = await request.json();
    const { postId, content } = body;
    
    if (!postId || !content) {
      return NextResponse.json(
        errorResponse('参数缺失'),
        { status: 400 }
      );
    }
    
    const prisma = await getPrisma();
    
    // 检查用户是否绑定了 GitHub 账号
    if (!user.github_id || !user.github_access_token) {
      return NextResponse.json(
        errorResponse('请先绑定 GitHub 账号'),
        { status: 403 }
      );
    }
    
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
    
    const githubRepo = process.env.GITHUB_REPO; // 格式: owner/repo
    
    if (!githubRepo) {
      return NextResponse.json(
        errorResponse('GitHub 仓库配置缺失'),
        { status: 500 }
      );
    }
    
    // 如果文章还没有关联 GitHub Issue，先创建 Issue
    let issueNumber: number | null = post.github_issue_number;
    let issueId = post.github_issue_id;
    
    if (!issueNumber) {
      // 创建新的 GitHub Issue
      const issue = await createGithubIssue(
        user.github_access_token,
        githubRepo,
        `评论: ${post.title}`,
        `文章链接: ${process.env.NEXT_PUBLIC_SITE_URL || ''}${post.path}\n\n---\n\n此 Issue 用于存储文章评论。`
      );
      
      issueNumber = issue.number;
      issueId = issue.id;
      
      // 更新文章的 GitHub Issue 信息
      await prisma.tbPost.update({
        where: { id: post.id },
        data: {
          github_issue_number: issueNumber,
          github_issue_id: issueId,
        },
      });
    }
    
    // 兜底校验，保证类型收窄为 number
    if (!issueNumber) {
      return NextResponse.json(
        errorResponse('GitHub Issue 编号无效'),
        { status: 500 }
      );
    }
    
    // 在 GitHub Issue 中添加评论
    const comment = await addGithubComment(
      user.github_access_token,
      githubRepo,
      issueNumber,
      content
    );
    
    return NextResponse.json(
      successResponse(
        {
          id: comment.id,
          author: comment.user.login,
          avatar: comment.user.avatar_url,
          content: comment.body,
          createdAt: comment.created_at,
          url: comment.html_url,
        },
        '评论成功'
      )
    );
  } catch (error) {
    console.error('创建评论失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建评论失败'),
      { status: 500 }
    );
  }
}
