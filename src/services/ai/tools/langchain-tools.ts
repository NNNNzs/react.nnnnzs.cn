/**
 * LangChain 格式的 AI 工具定义
 * 复用现有工具的业务逻辑（search-articles / search-posts-meta / search-collection）
 * 但使用 LangChain tool() + zod schema 定义参数，支持原生 Function Calling
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchArticlesTool as _searchArticlesTool } from './search-articles';
import { searchPostsMetaTool as _searchPostsMetaTool } from './search-posts-meta';
import { searchCollectionTool as _searchCollectionTool } from './search-collection';

/**
 * 文章语义搜索工具
 * 通过向量相似度搜索相关文章
 */
export const lcSearchArticlesTool = tool(
  async ({ query, limit }) => {
    const result = await _searchArticlesTool.execute({ query, limit: limit ?? 5 });
    if (!result.success) return JSON.stringify({ error: result.error });
    return JSON.stringify(result.data);
  },
  {
    name: 'search_articles',
    description:
      '在知识库中搜索与查询相关的文章。当用户询问关于博客文章、技术文档或知识库内容的问题时，使用此工具检索相关信息。',
    schema: z.object({
      query: z.string().describe('搜索查询文本，描述用户想要查找的内容'),
      limit: z
        .number()
        .optional()
        .describe('返回结果数量限制，默认为 5，建议根据涉及标签的文章数量设置（可高达 100）'),
    }),
  },
);

/**
 * 文章元数据搜索工具
 * 按时间、标签、分类、热度等维度查询文章
 */
export const lcSearchPostsMetaTool = tool(
  async ({ limit, sort_by, sort_order, tags, category, date_from, date_to, keyword }) => {
    const result = await _searchPostsMetaTool.execute({
      limit,
      sort_by,
      sort_order,
      tags,
      category,
      date_from,
      date_to,
      keyword,
    });
    if (!result.success) return JSON.stringify({ error: result.error });
    return JSON.stringify(result.data);
  },
  {
    name: 'search_posts_meta',
    description:
      '按时间、标签、分类、热度等维度查询文章列表。当用户询问"最近的文章"、"最受欢迎的文章"、"某年某月的文章"、"某个分类的文章"时使用此工具。',
    schema: z.object({
      limit: z.number().optional().describe('返回结果数量（1-100），默认 20'),
      sort_by: z
        .enum(['date', 'updated', 'visitors', 'likes'])
        .optional()
        .describe('排序字段'),
      sort_order: z
        .enum(['asc', 'desc'])
        .optional()
        .describe('排序方向：asc（升序）、desc（降序，默认）'),
      tags: z.string().optional().describe('标签筛选，逗号分隔，如："技术,旅行"'),
      category: z.string().optional().describe('分类筛选'),
      date_from: z.string().optional().describe('起始日期，如 "2024-01-01"'),
      date_to: z.string().optional().describe('结束日期，如 "2024-12-31"'),
      keyword: z.string().optional().describe('关键词搜索（匹配标题和描述）'),
    }),
  },
);

/**
 * 合集搜索工具
 * 在指定合集中搜索文章
 */
export const lcSearchCollectionTool = tool(
  async ({ collection, query }) => {
    const result = await _searchCollectionTool.execute({ collection, query });
    if (!result.success) return JSON.stringify({ error: result.error });
    return JSON.stringify(result.data);
  },
  {
    name: 'search_collection',
    description:
      '在指定的文章合集中查找文章。当用户询问某个特定合集（如"小破站建设"、"旅游日记"等）的内容时，使用此工具。',
    schema: z.object({
      collection: z.string().describe('合集的 slug 标识符，如 "xiaopozhan-jianshe"'),
      query: z.string().optional().describe('搜索关键词，用于在合集中筛选相关文章'),
    }),
  },
);

/**
 * 所有 LangChain 工具集合
 */
export const chatTools = [
  lcSearchArticlesTool,
  lcSearchPostsMetaTool,
  lcSearchCollectionTool,
];
