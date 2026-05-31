/**
 * GitHub Commits 查询 API
 * GET /api/activity/commits?limit=8
 */
import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/dto/response.dto';
import redisService from '@/lib/redis';

export const runtime = 'nodejs';

const CACHE_KEY = 'activity:commits';
const CACHE_TTL_SECONDS = 600; // 10 分钟

const REPO_OWNER = 'nnnnzs';
const REPO_NAME = 'react.nnnnzs.cn';

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
      name: string;
    };
  };
  html_url: string;
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 8));

    const cached = await redisService.get(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached as string) as CommitEntry[];
      return NextResponse.json(successResponse(data.slice(0, limit)));
    }

    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nnnnzs.cn',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=20`,
      { headers, next: { revalidate: 600 } },
    );

    if (!res.ok) {
      console.error('GitHub API 请求失败:', res.status, res.statusText);
      return NextResponse.json(successResponse([]));
    }

    const commits = (await res.json()) as GitHubCommit[];

    const data: CommitEntry[] = commits.map((c) => ({
      hash: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      date: c.commit.author.date,
      url: c.html_url,
    }));

    await redisService.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(data));

    return NextResponse.json(successResponse(data.slice(0, limit)));
  } catch (error) {
    console.error('获取 Commits 失败:', error);
    return NextResponse.json(errorResponse('获取 Commits 失败'), { status: 500 });
  }
}

interface CommitEntry {
  hash: string;
  message: string;
  date: string;
  url: string;
}
