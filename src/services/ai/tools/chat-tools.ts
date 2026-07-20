import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { githubSearchTool } from './github-search';
import { searchCollectionTool } from './search-collection';
import {
  searchArticlesLangChainTool,
  searchPostsLangChainTool,
} from './article-tools';
import {
  chatListPromptsTool,
  chatLoadPromptTemplateTool,
} from './prompt-template-tools';
import { assembleAgentTools } from './tool-assembly';
import { serializeToolResult } from './tool-result';
import { webSearchLangChainTool } from './web-tools';

const searchCollectionLangChainTool = tool(
  async ({ collection, query }) => serializeToolResult(
    await searchCollectionTool.execute({ collection, query }),
  ),
  {
    name: 'search_collection',
    description: '在指定博客合集中按关键词查找文章。',
    schema: z.object({
      collection: z.string().min(1).describe('合集名称或 slug'),
      query: z.string().optional().describe('文章筛选关键词'),
    }),
  },
);

const githubSearchLangChainTool = tool(
  async ({ type, query, username, repo, language, sort, order, state, limit }) => (
    serializeToolResult(await githubSearchTool.execute({
      type,
      query,
      username,
      repo,
      language,
      sort,
      order,
      state,
      limit,
    }))
  ),
  {
    name: 'github_search',
    description: '搜索 GitHub 仓库、Issue/PR、用户仓库或 Star 列表。',
    schema: z.object({
      type: z
        .enum(['repositories', 'issues', 'users', 'user_repositories', 'user_starred'])
        .describe('搜索类型'),
      query: z.string().optional().describe('搜索关键词或 GitHub 搜索语法'),
      username: z.string().optional().describe('GitHub 用户名'),
      repo: z.string().optional().describe('仓库全名，如 vercel/next.js'),
      language: z.string().optional().describe('仓库语言'),
      sort: z.string().optional().describe('排序字段'),
      order: z.enum(['desc', 'asc']).optional().describe('排序方向'),
      state: z.enum(['open', 'closed', 'all']).optional().describe('Issue 状态'),
      limit: z.number().int().min(1).max(20).optional().describe('返回数量，默认 5'),
    }),
  },
);

export const chatTools = assembleAgentTools([
  searchArticlesLangChainTool,
  searchPostsLangChainTool,
  searchCollectionLangChainTool,
  githubSearchLangChainTool,
  webSearchLangChainTool,
  chatListPromptsTool,
  chatLoadPromptTemplateTool,
]);
