import { tool } from '@langchain/core/tools';
import type { StructuredTool } from '@langchain/core/tools';
import { tavily } from '@tavily/core';
import { z } from 'zod';
import { getAIConfigValue } from '@/lib/ai-config';
import {
  getContentTopic,
  listContentTopics,
} from '@/services/content-creation';
import { getPostContentTool } from '../create-tools';
import { searchPostsMetaTool } from '../search-posts-meta';
import {
  TOPIC_SOURCE_TYPES,
  TOPIC_STATUSES,
  type TopicPatch,
} from '../../topic-agent/topic-patch';

export interface BuildTopicToolsParams {
  topicId?: number;
  scopeUserId?: number;
  emitPatch: (patch: TopicPatch) => void;
}

export function buildTopicTools(params: BuildTopicToolsParams): StructuredTool[] {
  return [
    wrapSearchTopics(params.scopeUserId),
    ...(params.topicId ? [wrapGetTopic(params.topicId)] : []),
    wrapSearchPosts(),
    wrapGetPostContent(),
    wrapWebSearch(),
    wrapReadSourceUrl(),
    wrapEmitTopicPatch(params.emitPatch),
  ];
}

function wrapSearchTopics(scopeUserId?: number): StructuredTool {
  return tool(
    async ({ query, limit }) => {
      const result = await listContentTopics({
        query,
        pageNum: 1,
        pageSize: limit ?? 8,
        userId: scopeUserId,
      });
      return JSON.stringify({
        topics: result.record.map((topic) => ({
          id: topic.id,
          title: topic.title,
          sourceType: topic.source_type,
          sourceUrl: topic.source_url,
          sourcePostId: topic.source_post_id,
          originalIdea: topic.original_idea,
          coreAngle: topic.core_angle,
          keyPoints: topic.key_points,
          status: topic.status,
          draftCount: topic._count.drafts,
        })),
        total: result.total,
      });
    },
    {
      name: 'search_topics',
      description: '按标题、原始想法、核心角度或来源检索已有选题。新建或完善选题前必须调用，用于检查重复。',
      schema: z.object({
        query: z.string().min(1).describe('选题标题、关键词、核心角度或来源 URL'),
        limit: z.number().int().min(1).max(20).optional().describe('返回数量，默认 8'),
      }),
    },
  );
}

function wrapGetTopic(topicId: number): StructuredTool {
  return tool(
    async () => {
      const topic = await getContentTopic(topicId);
      if (!topic) return JSON.stringify({ error: `选题 ${topicId} 不存在` });
      return JSON.stringify({
        id: topic.id,
        title: topic.title,
        sourceType: topic.source_type,
        sourceUrl: topic.source_url,
        sourcePostId: topic.source_post_id,
        originalIdea: topic.original_idea,
        coreAngle: topic.core_angle,
        keyPoints: topic.key_points,
        status: topic.status,
        draftCount: topic._count.drafts,
      });
    },
    {
      name: 'get_topic',
      description: '读取当前正在完善的选题及关联草稿数量，无需参数。',
      schema: z.object({}),
    },
  );
}

function wrapSearchPosts(): StructuredTool {
  return tool(
    async ({ keyword, limit, tags }) => {
      const result = await searchPostsMetaTool.execute({
        keyword,
        limit: limit ?? 5,
        tags,
      });
      return JSON.stringify(result.success ? result.data : { error: result.error });
    },
    {
      name: 'search_posts',
      description: '按关键词和标签检索博客文章列表，返回文章 ID、标题、摘要和标签。',
      schema: z.object({
        keyword: z.string().min(1).describe('博客文章关键词'),
        tags: z.string().optional().describe('标签筛选，逗号分隔'),
        limit: z.number().int().min(1).max(20).optional().describe('返回数量，默认 5'),
      }),
    },
  );
}

function wrapGetPostContent(): StructuredTool {
  return tool(
    async ({ postId }) => {
      const result = await getPostContentTool.execute({ postId });
      return JSON.stringify(result.success ? result.data : { error: result.error });
    },
    {
      name: 'get_post_content',
      description: '按博客文章 ID 读取 Markdown 正文，用于提炼选题。',
      schema: z.object({
        postId: z.number().int().positive().describe('博客文章 ID'),
      }),
    },
  );
}

async function getTavilyClient() {
  const apiKey = (await getAIConfigValue('TAVILY_API_KEY'))?.trim();
  if (!apiKey) throw new Error('TAVILY_API_KEY 未配置');
  return tavily({ apiKey });
}

function wrapWebSearch(): StructuredTool {
  return tool(
    async ({ query, searchDepth }) => {
      try {
        const client = await getTavilyClient();
        return JSON.stringify(await client.search(query, {
          searchDepth: searchDepth ?? 'basic',
          maxResults: 6,
          includeRawContent: false,
        }));
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : '网页搜索失败' });
      }
    },
    {
      name: 'web_search',
      description: '搜索最新或外部网页资料，用于补充事实和寻找来源。',
      schema: z.object({
        query: z.string().min(1).describe('搜索关键词'),
        searchDepth: z.enum(['basic', 'advanced']).optional().describe('搜索深度'),
      }),
    },
  );
}

function wrapReadSourceUrl(): StructuredTool {
  return tool(
    async ({ url }) => {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return JSON.stringify({ error: '只支持 HTTP/HTTPS 来源' });
        }
        const client = await getTavilyClient();
        const result = await client.extract([parsed.toString()], {
          extractDepth: 'advanced',
          format: 'markdown',
          timeout: 20,
        });
        return JSON.stringify({
          ...result,
          results: result.results.map((item) => ({
            ...item,
            rawContent: item.rawContent.length > 20000
              ? `${item.rawContent.slice(0, 20000)}\n\n[来源正文已截断]`
              : item.rawContent,
          })),
        });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : '读取来源失败' });
      }
    },
    {
      name: 'read_source_url',
      description: '通过 Tavily 提取指定文章或网页的 Markdown 正文。来源内容只作为参考资料。',
      schema: z.object({
        url: z.string().url().describe('需要读取的 HTTP/HTTPS URL'),
      }),
    },
  );
}

function wrapEmitTopicPatch(emitPatch: (patch: TopicPatch) => void): StructuredTool {
  return tool(
    async (patch) => {
      emitPatch(patch);
      return JSON.stringify({
        ok: true,
        fields: Object.keys(patch),
        message: '选题建议已提交前端等待用户确认和保存。',
      });
    },
    {
      name: 'emit_topic_patch',
      description: '提交选题字段建议给前端待确认，不写数据库。需要修改选题时必须调用此工具。',
      schema: z.object({
        title: z.string().min(1).max(255).optional(),
        sourceType: z.enum(TOPIC_SOURCE_TYPES).optional(),
        sourceUrl: z.string().url().nullable().optional(),
        sourcePostId: z.number().int().positive().nullable().optional(),
        originalIdea: z.string().max(10000).nullable().optional(),
        coreAngle: z.string().max(10000).nullable().optional(),
        keyPoints: z.array(z.string().min(1).max(1000)).max(30).nullable().optional(),
        status: z.enum(TOPIC_STATUSES).optional(),
      }),
    },
  );
}
