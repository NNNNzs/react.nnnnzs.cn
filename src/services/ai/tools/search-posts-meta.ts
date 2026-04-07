/**
 * 文章元数据搜索工具
 * 支持按时间、标签、分类、热度等维度查询文章
 * 不依赖向量搜索，直接查询数据库
 */

import type { Tool, ToolResult } from './index';

/**
 * 文章元数据搜索工具
 */
export const searchPostsMetaTool: Tool = {
  name: 'search_posts_meta',
  description: '按时间、标签、分类、热度等维度查询文章列表。当用户询问"最近的文章"、"最受欢迎的文章"、"某年某月的文章"、"某个分类的文章"时使用此工具。',
  parameters: {
    limit: {
      type: 'number',
      description: '返回结果数量（1-100），默认 20',
      required: false,
    },
    sort_by: {
      type: 'string',
      description: '排序字段：date（发布时间）、updated（更新时间）、visitors（浏览量）、likes（点赞数）',
      required: false,
    },
    sort_order: {
      type: 'string',
      description: '排序方向：asc（升序）、desc（降序，默认）',
      required: false,
    },
    tags: {
      type: 'string',
      description: '标签筛选，逗号分隔，如："技术,旅行"',
      required: false,
    },
    category: {
      type: 'string',
      description: '分类筛选',
      required: false,
    },
    date_from: {
      type: 'string',
      description: '起始日期，ISO 格式，如："2024-01-01"',
      required: false,
    },
    date_to: {
      type: 'string',
      description: '结束日期，ISO 格式，如："2024-12-31"',
      required: false,
    },
    keyword: {
      type: 'string',
      description: '关键词搜索（匹配标题和描述）',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const limit = Math.min((args.limit as number) || 20, 100);
      const sort_by = (args.sort_by as string) || 'date';
      const sort_order = (args.sort_order as string) || 'desc';
      const tags = (args.tags as string) || '';
      const category = (args.category as string) || '';
      const date_from = (args.date_from as string) || '';
      const date_to = (args.date_to as string) || '';
      const keyword = (args.keyword as string) || '';

      // 构建查询参数
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      if (sort_by) queryParams.append('sort_by', sort_by);
      if (sort_order) queryParams.append('sort_order', sort_order);
      if (tags) queryParams.append('tags', tags);
      if (category) queryParams.append('category', category);
      if (date_from) queryParams.append('date_from', date_from);
      if (date_to) queryParams.append('date_to', date_to);
      if (keyword) queryParams.append('keyword', keyword);

      // 调用 API
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/post/query?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}`,
        };
      }

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.message || '查询失败',
        };
      }

      const data = result.data;

      // 格式化返回结果
      const formattedResults = data.results.map((post: any) => ({
        id: post.id,
        title: post.title,
        url: post.path,
        description: post.description,
        date: post.date,
        updated: post.updated,
        tags: post.tags,
        category: post.category,
        visitors: post.visitors,
        likes: post.likes,
        cover: post.cover,
      }));

      return {
        success: true,
        data: {
          results: formattedResults,
          total: data.total,
          limit: data.limit,
          offset: data.offset,
          query: {
            sort_by,
            sort_order,
            tags,
            category,
            date_from,
            date_to,
            keyword,
          },
          message: `找到 ${formattedResults.length} 篇文章（共 ${data.total} 篇）`,
        },
      };
    } catch (error) {
      console.error('❌ 文章元数据搜索失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索失败',
      };
    }
  },
};
