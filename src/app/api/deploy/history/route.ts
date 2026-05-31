/**
 * 部署历史查询 API
 * GET /api/deploy/history?limit=24
 *
 * 直接从 GitHub Actions API 查询 Docker Release workflow 的最近运行记录，
 * 不依赖 webhook 累积，首次即可获得真实部署历史。
 */
import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/dto/response.dto';
import redisService from '@/lib/redis';

export const runtime = 'nodejs';

const CACHE_KEY = 'deploy:history';
const CACHE_TTL_SECONDS = 300; // 5 分钟

const REPO_OWNER = 'nnnnzs';
const REPO_NAME = 'react.nnnnzs.cn';
const WORKFLOW_FILE = 'docker-release.yml';

interface GitHubWorkflowRun {
  id: number;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  head_sha: string;
  html_url: string;
  run_number: number;
  display_title: string;
}

interface DeployRecord {
  status: 'deploying' | 'success' | 'failure';
  timestamp: string;
  commit: string;
  version: string;
  runId: number;
  url: string;
}

function mapConclusionToStatus(status: string | null, conclusion: string | null): DeployRecord['status'] {
  if (status === 'in_progress' || status === 'queued') return 'deploying';
  if (conclusion === 'success') return 'success';
  return 'failure';
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 24));

    const cached = await redisService.get(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached as string) as DeployRecord[];
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
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}`,
      { headers, next: { revalidate: 300 } },
    );

    if (!res.ok) {
      console.error('GitHub Actions API 请求失败:', res.status, res.statusText);
      return NextResponse.json(successResponse([]));
    }

    const json = (await res.json()) as { workflow_runs: GitHubWorkflowRun[] };

    const data: DeployRecord[] = json.workflow_runs.map((run) => ({
      status: mapConclusionToStatus(run.status, run.conclusion),
      timestamp: run.created_at,
      commit: run.head_sha.slice(0, 7),
      message: run.display_title.split('\n')[0],
      version: `#${run.run_number}`,
      runId: run.id,
      url: run.html_url,
    }));

    await redisService.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(data));

    return NextResponse.json(successResponse(data.slice(0, limit)));
  } catch (error) {
    console.error('获取部署历史失败:', error);
    return NextResponse.json(errorResponse('获取部署历史失败'), { status: 500 });
  }
}
