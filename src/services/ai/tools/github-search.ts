/**
 * GitHub 搜索工具
 * 面向 Chat Agent 的轻量 GitHub API 封装，用于检索开源项目、Issue、用户仓库和 Star 列表。
 */

import { proxyFetch } from '@/lib/proxy-fetch';
import type { Tool, ToolResult } from './index';

type GitHubSearchType =
  | 'repositories'
  | 'issues'
  | 'users'
  | 'user_repositories'
  | 'user_starred';

interface GitHubOwner {
  login?: string;
  html_url?: string;
}

interface GitHubRepository {
  full_name?: string;
  name?: string;
  description?: string | null;
  html_url?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  updated_at?: string;
  owner?: GitHubOwner;
}

interface GitHubIssue {
  title?: string;
  html_url?: string;
  state?: string;
  number?: number;
  comments?: number;
  created_at?: string;
  updated_at?: string;
  user?: GitHubOwner;
  pull_request?: unknown;
  repository_url?: string;
}

interface GitHubUser {
  login?: string;
  html_url?: string;
  avatar_url?: string;
  type?: string;
}

interface GitHubSearchResponse<T> {
  total_count?: number;
  incomplete_results?: boolean;
  items?: T[];
}

interface GitHubRateLimit {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
}

const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

function clampLimit(limit: unknown): number {
  const numericLimit = typeof limit === 'number' ? limit : DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(numericLimit)));
}

function getRateLimit(response: Response): GitHubRateLimit {
  return {
    limit: response.headers.get('x-ratelimit-limit'),
    remaining: response.headers.get('x-ratelimit-remaining'),
    reset: response.headers.get('x-ratelimit-reset'),
  };
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'nnnnzs.cn-ai-agent',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function githubGet<T>(path: string, params: URLSearchParams): Promise<{
  data: T;
  rateLimit: GitHubRateLimit;
}> {
  const url = new URL(`${GITHUB_API_BASE}${path}`);
  params.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await proxyFetch(url, {
      headers: getGitHubHeaders(),
      next: { revalidate: 300 },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`GitHub API 请求超时（${GITHUB_REQUEST_TIMEOUT_MS / 1000} 秒）`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`GitHub API 请求失败：HTTP ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 240)}` : ''}`);
  }

  return {
    data: (await response.json()) as T,
    rateLimit: getRateLimit(response),
  };
}

function parseRepo(repo: unknown): { owner: string; name: string } | null {
  if (typeof repo !== 'string') return null;
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  return { owner, name };
}

function formatRepository(repo: GitHubRepository) {
  return {
    fullName: repo.full_name || repo.name || '',
    description: repo.description || '',
    url: repo.html_url || '',
    owner: repo.owner?.login || '',
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    language: repo.language || '',
    updatedAt: repo.updated_at || '',
  };
}

function formatIssue(issue: GitHubIssue) {
  const repositoryFullName = issue.repository_url?.replace(`${GITHUB_API_BASE}/repos/`, '') || '';

  return {
    title: issue.title || '',
    url: issue.html_url || '',
    state: issue.state || '',
    number: issue.number ?? 0,
    author: issue.user?.login || '',
    comments: issue.comments ?? 0,
    repository: repositoryFullName,
    type: issue.pull_request ? 'pull_request' : 'issue',
    createdAt: issue.created_at || '',
    updatedAt: issue.updated_at || '',
  };
}

function formatUser(user: GitHubUser) {
  return {
    login: user.login || '',
    url: user.html_url || '',
    avatarUrl: user.avatar_url || '',
    type: user.type || '',
  };
}

function buildRepositoryQuery(query: string, language: string, sort: string): string {
  const parts = [query.trim()];
  if (language) parts.push(`language:${language}`);
  if (!/\b(is:|archived:)/.test(query)) parts.push('archived:false');
  if (sort === 'stars' && !/\bstars:/.test(query)) parts.push('stars:>0');
  return parts.filter(Boolean).join(' ');
}

function buildIssueQuery(query: string, repo: string, state: string): string {
  const parts = [query.trim()];
  if (repo) parts.push(`repo:${repo}`);
  if (state !== 'all') parts.push(`state:${state}`);
  if (!/\b(is:issue|is:pr|is:pull-request)\b/.test(query)) parts.push('is:issue');
  return parts.filter(Boolean).join(' ');
}

/**
 * GitHub 搜索工具
 */
export const githubSearchTool: Tool = {
  name: 'github_search',
  description: 'GitHub 搜索工具：搜索开源仓库、Issue/PR、GitHub 用户、指定用户的仓库列表或 Star 列表。适合回答"有什么开源项目"、"有哪些作品"、"某仓库有哪些 issue"、"某用户 star 了什么"等问题。',
  parameters: {
    type: {
      type: 'string',
      description: '搜索类型：repositories、issues、users、user_repositories、user_starred',
      required: true,
    },
    query: {
      type: 'string',
      description: '搜索关键词，支持 GitHub 搜索语法，如 "nextjs auth language:typescript"',
      required: false,
    },
    username: {
      type: 'string',
      description: 'GitHub 用户名，用于 user_repositories 或 user_starred',
      required: false,
    },
    repo: {
      type: 'string',
      description: '仓库全名，如 "vercel/next.js"，用于 issues 搜索',
      required: false,
    },
    language: {
      type: 'string',
      description: '仓库语言筛选，如 TypeScript、Python、Go',
      required: false,
    },
    sort: {
      type: 'string',
      description: '排序字段。repositories 支持 stars/forks/updated；issues 支持 created/updated/comments；users 支持 followers/repositories/joined；用户仓库和 Star 列表支持 created/updated/pushed/full_name',
      required: false,
    },
    order: {
      type: 'string',
      description: '排序方向：desc 或 asc，默认 desc',
      required: false,
    },
    state: {
      type: 'string',
      description: 'Issue 状态：open、closed、all，默认 open',
      required: false,
    },
    limit: {
      type: 'number',
      description: '返回结果数量，默认 5，最多 20',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const type = args.type as GitHubSearchType;
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      const username = typeof args.username === 'string' ? args.username.trim() : '';
      const repo = typeof args.repo === 'string' ? args.repo.trim() : '';
      const language = typeof args.language === 'string' ? args.language.trim() : '';
      const sort = typeof args.sort === 'string' ? args.sort.trim() : '';
      const order = args.order === 'asc' ? 'asc' : 'desc';
      const state = args.state === 'closed' || args.state === 'all' ? args.state : 'open';
      const limit = clampLimit(args.limit);

      if (!['repositories', 'issues', 'users', 'user_repositories', 'user_starred'].includes(type)) {
        return {
          success: false,
          error: 'type 必须是 repositories、issues、users、user_repositories 或 user_starred',
        };
      }

      if (['repositories', 'issues', 'users'].includes(type) && !query && !(type === 'issues' && repo)) {
        return {
          success: false,
          error: 'query 不能为空；搜索仓库、Issue 或用户时需要提供关键词',
        };
      }

      if (['user_repositories', 'user_starred'].includes(type) && !username) {
        return {
          success: false,
          error: 'username 不能为空；查询用户仓库或 Star 列表时需要提供 GitHub 用户名',
        };
      }

      if (type === 'repositories') {
        const params = new URLSearchParams({
          q: buildRepositoryQuery(query, language, sort),
          sort: sort || 'stars',
          order,
          per_page: String(limit),
        });
        const { data, rateLimit } = await githubGet<GitHubSearchResponse<GitHubRepository>>('/search/repositories', params);
        const results = (data.items || []).map(formatRepository);

        return {
          success: true,
          data: {
            type,
            query: params.get('q'),
            results,
            total: data.total_count ?? results.length,
            incompleteResults: data.incomplete_results ?? false,
            rateLimit,
          },
        };
      }

      if (type === 'issues') {
        if (repo && !parseRepo(repo)) {
          return {
            success: false,
            error: 'repo 格式必须是 owner/name，例如 vercel/next.js',
          };
        }

        const params = new URLSearchParams({
          q: buildIssueQuery(query, repo, state),
          sort: sort || 'updated',
          order,
          per_page: String(limit),
        });
        const { data, rateLimit } = await githubGet<GitHubSearchResponse<GitHubIssue>>('/search/issues', params);
        const results = (data.items || []).map(formatIssue);

        return {
          success: true,
          data: {
            type,
            query: params.get('q'),
            results,
            total: data.total_count ?? results.length,
            incompleteResults: data.incomplete_results ?? false,
            rateLimit,
          },
        };
      }

      if (type === 'users') {
        const params = new URLSearchParams({
          q: query,
          sort: sort || 'repositories',
          order,
          per_page: String(limit),
        });
        const { data, rateLimit } = await githubGet<GitHubSearchResponse<GitHubUser>>('/search/users', params);
        const results = (data.items || []).map(formatUser);

        return {
          success: true,
          data: {
            type,
            query,
            results,
            total: data.total_count ?? results.length,
            incompleteResults: data.incomplete_results ?? false,
            rateLimit,
          },
        };
      }

      const path = type === 'user_repositories'
        ? `/users/${encodeURIComponent(username)}/repos`
        : `/users/${encodeURIComponent(username)}/starred`;
      const params = new URLSearchParams({
        sort: sort || 'updated',
        direction: order,
        per_page: String(limit),
      });
      const { data, rateLimit } = await githubGet<GitHubRepository[]>(path, params);
      const results = data.map(formatRepository);

      return {
        success: true,
        data: {
          type,
          username,
          results,
          total: results.length,
          rateLimit,
        },
      };
    } catch (error) {
      console.error('❌ GitHub 搜索失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'GitHub 搜索失败',
      };
    }
  },
};
