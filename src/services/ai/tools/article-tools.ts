import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPostById } from '@/services/post';
import { searchArticlesTool } from './search-articles';
import { searchPostsMetaTool } from './search-posts-meta';
import {
  serializeToolData,
  serializeToolError,
  serializeToolResult,
} from './tool-result';

export const searchArticlesLangChainTool = tool(
  async ({ query, limit }) => serializeToolResult(
    await searchArticlesTool.execute({ query, limit: limit ?? 5 }),
  ),
  {
    name: 'search_articles',
    description: '通过向量相似度在知识库中检索相关文章和正文片段。',
    schema: z.object({
      query: z.string().min(1).describe('搜索查询文本'),
      limit: z.number().int().min(1).max(100).optional().describe('返回数量，默认 5'),
    }),
  },
);

export const searchPostsLangChainTool = tool(
  async ({ limit, sort_by, sort_order, tags, category, date_from, date_to, keyword }) => (
    serializeToolResult(await searchPostsMetaTool.execute({
      limit,
      sort_by,
      sort_order,
      tags,
      category,
      date_from,
      date_to,
      keyword,
    }))
  ),
  {
    name: 'search_posts',
    description: '按关键词、标签、分类、日期或热度等条件查询博客文章元数据。',
    schema: z.object({
      limit: z.number().int().min(1).max(100).optional().describe('返回数量，默认 20'),
      sort_by: z
        .enum(['date', 'updated', 'visitors', 'likes'])
        .optional()
        .describe('排序字段'),
      sort_order: z
        .enum(['asc', 'desc'])
        .optional()
        .describe('排序方向，默认 desc'),
      tags: z.string().optional().describe('标签筛选，逗号分隔'),
      category: z.string().optional().describe('分类筛选'),
      date_from: z.string().optional().describe('起始日期，如 2024-01-01'),
      date_to: z.string().optional().describe('结束日期，如 2024-12-31'),
      keyword: z.string().optional().describe('匹配标题和描述的关键词'),
    }),
  },
);

export const getPostContentLangChainTool = tool(
  async ({ postId }) => {
    try {
      const post = await getPostById(postId);
      if (!post) return serializeToolData({ error: `文章 ${postId} 不存在` });

      return serializeToolData({
        id: post.id,
        title: post.title,
        path: post.path,
        description: post.description,
        tags: post.tags,
        category: post.category,
        content: post.content,
      });
    } catch (error) {
      return serializeToolError(error, '读取文章失败');
    }
  },
  {
    name: 'get_post_content',
    description: '按博客文章 ID 读取 Markdown 正文。',
    schema: z.object({
      postId: z.number().int().positive().describe('博客文章 ID'),
    }),
  },
);
