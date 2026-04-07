/**
 * 合集搜索工具
 * 在指定合集中搜索文章
 */

import { getCollectionBySlug } from '@/services/collection';
import type { Tool, ToolResult } from './index';

/**
 * 合集搜索工具
 */
export const searchCollectionTool: Tool = {
  name: 'search_collection',
  description: '在指定的文章合集中查找文章。当用户询问某个特定合集（如"小破站建设"、"旅游日记"等）的内容时，使用此工具。',
  parameters: {
    collection: {
      type: 'string',
      description: '合集的 slug 标识符，如 "xiaopozhan-jianshe"',
      required: true,
    },
    query: {
      type: 'string',
      description: '搜索关键词，用于在合集中筛选相关文章',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const collectionSlug = args.collection as string;
      const query = args.query as string || '';

      if (!collectionSlug || typeof collectionSlug !== 'string' || collectionSlug.trim().length === 0) {
        return {
          success: false,
          error: '合集标识符不能为空',
        };
      }

      // 获取合集详情
      const collection = await getCollectionBySlug(collectionSlug);

      if (!collection) {
        return {
          success: false,
          error: `未找到合集 "${collectionSlug}"，请检查合集标识符是否正确`,
        };
      }

      // 过滤文章：如果有查询关键词，则按标题和描述筛选
      let articles = collection.articles;

      if (query.trim()) {
        const queryLower = query.toLowerCase();
        articles = articles.filter((article) => {
          const titleMatch = article.title?.toLowerCase().includes(queryLower);
          const descMatch = article.description?.toLowerCase().includes(queryLower);
          return titleMatch || descMatch;
        });
      }

      // 格式化结果
      const results = articles.map((article) => ({
        id: article.id,
        title: article.title,
        url: article.path,
        description: article.description,
        date: article.date,
        tags: article.tags,
        category: article.category,
      }));

      return {
        success: true,
        data: {
          collection: {
            id: collection.id,
            title: collection.title,
            slug: collection.slug,
            description: collection.description,
          },
          query,
          results,
          totalResults: results.length,
          message: `在合集《${collection.title}》中找到 ${results.length} 篇文章${query ? `（关键词：${query}）` : ''}`,
        },
      };
    } catch (error) {
      console.error('❌ 合集搜索失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '合集搜索失败',
      };
    }
  },
};
