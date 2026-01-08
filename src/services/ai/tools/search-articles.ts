/**
 * 文章搜索工具
 * 通过向量相似度搜索相关文章
 */

import { embedText } from '@/services/embedding/embedding';
import { searchSimilarVectors } from '@/services/embedding/vector-store';
import { getPostById } from '@/services/post';
import type { Tool, ToolResult } from './index';

/**
 * 文章搜索结果
 */
interface ArticleSearchResult {
  postId: number;
  title: string;
  url: string | null;
  chunks: Array<{
    chunkIndex: number;
    chunkText: string;
    score: number;
  }>;
}

/**
 * 文章搜索工具
 */
export const searchArticlesTool: Tool = {
  name: 'search_articles',
  description: '在知识库中搜索与查询相关的文章。当用户询问关于博客文章、技术文档或知识库内容的问题时，使用此工具检索相关信息。',
  parameters: {
    query: {
      type: 'string',
      description: '搜索查询文本，描述用户想要查找的内容',
      required: true,
    },
    limit: {
      type: 'number',
      description: '返回结果数量限制，默认为 5',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const query = args.query as string;
      const limit = (args.limit as number) || 5;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          success: false,
          error: '查询文本不能为空',
        };
      }

      if (limit < 1 || limit > 20) {
        return {
          success: false,
          error: 'limit 必须在 1-20 之间',
        };
      }

      console.log(`🔍 开始搜索文章: "${query}", limit: ${limit}`);

      // 1. 将查询文本转换为向量
      const queryVector = await embedText(query);
      console.log(`✅ 查询向量化完成，维度: ${queryVector.length}`);

      // 2. 搜索相似向量（带重试机制）
      let searchResults: Array<{
        postId: number;
        chunkIndex: number;
        chunkText: string;
        title: string;
        score: number;
      }>;
      
      try {
        searchResults = await searchSimilarVectors(queryVector, limit, undefined, 2);
        console.log(`✅ 找到 ${searchResults.length} 个相关片段`);
      } catch (searchError) {
        // 向量搜索失败时的降级处理
        const errorMessage = searchError instanceof Error ? searchError.message : String(searchError);
        const isTimeoutError = errorMessage.includes('timeout') || 
                               errorMessage.includes('TIMEOUT') ||
                               errorMessage.includes('Connect Timeout');
        
        if (isTimeoutError) {
          console.error('❌ 向量搜索超时，可能是 Qdrant 服务不可用或网络问题');
          return {
            success: false,
            error: '向量搜索服务暂时不可用，请稍后重试。如果问题持续，请检查 Qdrant 服务状态。',
          };
        }
        
        // 其他错误直接抛出
        throw searchError;
      }

      if (searchResults.length === 0) {
        return {
          success: true,
          data: {
            query,
            results: [],
            message: '未找到相关文章',
          },
        };
      }

      // 3. 获取文章详细信息
      const uniquePostIds = [...new Set(searchResults.map((r) => r.postId))];
      const postInfoMap = new Map<number, { title: string; url: string | null }>();

      await Promise.all(
        uniquePostIds.map(async (postId) => {
          const post = await getPostById(postId);
          if (post) {
            // 注意：这里不包含 baseUrl，因为前端会根据当前域名生成 URL
            const postUrl = post.path || null;
            postInfoMap.set(postId, {
              title: post.title || `文章 ${postId}`,
              url: postUrl,
            });
          } else {
            postInfoMap.set(postId, {
              title: `文章 ${postId}`,
              url: null,
            });
          }
        })
      );

      // 4. 按文章分组结果
      const resultsByPost = new Map<number, ArticleSearchResult>();

      for (const result of searchResults) {
        const postInfo = postInfoMap.get(result.postId);
        if (!postInfo) continue;

        if (!resultsByPost.has(result.postId)) {
          resultsByPost.set(result.postId, {
            postId: result.postId,
            title: postInfo.title,
            url: postInfo.url,
            chunks: [],
          });
        }

        resultsByPost.get(result.postId)!.chunks.push({
          chunkIndex: result.chunkIndex,
          chunkText: result.chunkText,
          score: result.score,
        });
      }

      // 5. 转换为数组并按相关性排序（使用最高分）
      const results = Array.from(resultsByPost.values()).sort((a, b) => {
        const aMaxScore = Math.max(...a.chunks.map((c) => c.score));
        const bMaxScore = Math.max(...b.chunks.map((c) => c.score));
        return bMaxScore - aMaxScore;
      });

      return {
        success: true,
        data: {
          query,
          results,
          totalResults: results.length,
        },
      };
    } catch (error) {
      console.error('❌ 文章搜索失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索失败',
      };
    }
  },
};
