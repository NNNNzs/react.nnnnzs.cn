/**
 * 部署历史查询 API
 * GET /api/deploy/history?limit=24
 *
 * 页面请求按 5 分钟新鲜度懒加载 GitHub 历史，并与 webhook 实时增量合并。
 */
import { NextRequest, NextResponse } from 'next/server';
import { successResponse } from '@/dto/response.dto';
import {
  DEPLOY_GITHUB_HISTORY_KEY,
  DEPLOY_WEBHOOK_HISTORY_KEY,
  mergeDeployHistories,
  type DeployHistoryRecord,
} from '@/lib/deploy-history-cache';
import { getOrRefreshJsonCache } from '@/lib/redis-json-cache';
import redisService from '@/lib/redis';

export const runtime = 'nodejs';

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

function mapConclusionToStatus(status: string | null, conclusion: string | null): DeployHistoryRecord['status'] {
  if (status === 'in_progress' || status === 'queued') return 'deploying';
  if (conclusion === 'success') return 'success';
  return 'failure';
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 24));

    const [githubHistory, webhookHistoryJson] = await Promise.all([
      getOrRefreshJsonCache<DeployHistoryRecord[]>({
        key: DEPLOY_GITHUB_HISTORY_KEY,
        ttlSeconds: 300,
        load: async () => {
          const token = process.env.GITHUB_TOKEN;
          const headers: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'nnnnzs.cn',
          };
          if (token) headers.Authorization = `Bearer ${token}`;

          const res = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=24`,
            { headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(8_000) },
          );
          if (!res.ok) throw new Error(`GitHub Actions API 请求失败: ${res.status} ${res.statusText}`);
          const json = (await res.json()) as { workflow_runs: GitHubWorkflowRun[] };
          return json.workflow_runs.map((run) => ({
            status: mapConclusionToStatus(run.status, run.conclusion),
            timestamp: run.created_at,
            commit: run.head_sha.slice(0, 7),
            message: run.display_title.split('\n')[0],
            version: `#${run.run_number}`,
            runId: run.id,
            url: run.html_url,
          }));
        },
      }),
      redisService.get(DEPLOY_WEBHOOK_HISTORY_KEY),
    ]);

    let webhookHistory: DeployHistoryRecord[] = [];
    if (webhookHistoryJson) {
      try {
        const parsed = JSON.parse(webhookHistoryJson) as unknown;
        if (Array.isArray(parsed)) webhookHistory = parsed as DeployHistoryRecord[];
      } catch {
        // 无效的增量快照不影响 GitHub 历史返回。
      }
    }
    const data = mergeDeployHistories(webhookHistory, githubHistory || []);

    return NextResponse.json(successResponse(data.slice(0, limit)), {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400' },
    });
  } catch (error) {
    console.error('获取部署历史失败:', error);
    return NextResponse.json(successResponse([]), {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' },
    });
  }
}
