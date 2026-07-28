/**
 * GitHub Commits 查询 API
 * GET /api/activity/commits?limit=8
 */
import { NextRequest, NextResponse } from 'next/server';
import { successResponse } from '@/dto/response.dto';
import { ACTIVITY_COMMITS_KEY, type ActivityCommit } from '@/lib/activity-commits';
import { getOrRefreshJsonCache } from '@/lib/redis-json-cache';

export const runtime = 'nodejs';

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

    const data = await getOrRefreshJsonCache<ActivityCommit[]>({
      key: ACTIVITY_COMMITS_KEY,
      ttlSeconds: 600,
      load: async () => {
        const token = process.env.GITHUB_TOKEN;
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'nnnnzs.cn',
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=20`,
          { headers, next: { revalidate: 600 }, signal: AbortSignal.timeout(8_000) },
        );
        if (!res.ok) throw new Error(`GitHub API 请求失败: ${res.status} ${res.statusText}`);
        const commits = (await res.json()) as GitHubCommit[];
        return commits.map((commit) => ({
          hash: commit.sha.slice(0, 7),
          message: commit.commit.message.split('\n')[0],
          date: commit.commit.author.date,
          url: commit.html_url,
        }));
      },
    });

    return NextResponse.json(successResponse((data || []).slice(0, limit)), {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' },
    });
  } catch (error) {
    console.error('获取 Commits 失败:', error);
    return NextResponse.json(successResponse([]), {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' },
    });
  }
}
