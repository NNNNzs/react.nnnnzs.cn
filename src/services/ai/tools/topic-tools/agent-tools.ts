import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getContentTopic,
  listContentTopics,
} from '@/services/content-creation';
import { serializeToolData, serializeToolError } from '../tool-result';
import {
  TOPIC_SOURCE_TYPES,
  TOPIC_STATUSES,
  type TopicPatch,
} from '../../topic-agent/topic-patch';

export interface SearchTopicsToolContext {
  scopeUserId?: number;
}

export interface CurrentTopicToolContext extends SearchTopicsToolContext {
  topicId: number;
  actorUserId: number;
}

export interface EmitTopicPatchToolContext {
  topicId?: number;
  actorUserId: number;
  emitPatch: (patch: TopicPatch) => void;
}

export function createSearchTopicsTool(context: SearchTopicsToolContext) {
  return tool(
    async ({ query, limit }) => {
      try {
        const result = await listContentTopics({
          query,
          pageNum: 1,
          pageSize: limit ?? 8,
          userId: context.scopeUserId,
        });
        return serializeToolData({
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
      } catch (error) {
        return serializeToolError(error, '检索选题失败');
      }
    },
    {
      name: 'search_topics',
      description: '按标题、原始想法、核心角度或来源检索当前数据范围内的已有选题。',
      schema: z.object({
        query: z.string().min(1).describe('选题标题、关键词、核心角度或来源 URL'),
        limit: z.number().int().min(1).max(20).optional().describe('返回数量，默认 8'),
      }),
    },
  );
}

export function createGetCurrentTopicTool(context: CurrentTopicToolContext) {
  return tool(
    async () => {
      try {
        const topic = await getContentTopic(context.topicId);
        if (!topic) return serializeToolData({ error: `选题 ${context.topicId} 不存在` });
        return serializeToolData({
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
      } catch (error) {
        return serializeToolError(error, '读取选题失败');
      }
    },
    {
      name: 'get_current_topic',
      description: '读取当前请求已授权选题及关联草稿数量，无需参数。',
      schema: z.object({}),
    },
  );
}

export function createEmitTopicPatchTool(context: EmitTopicPatchToolContext) {
  return tool(
    async (patch) => {
      context.emitPatch(patch);
      return serializeToolData({
        ok: true,
        fields: Object.keys(patch),
        message: '选题建议已提交前端等待用户确认和保存。',
      });
    },
    {
      name: 'emit_topic_patch',
      description: '把选题字段建议提交给前端等待用户确认，不直接写数据库。',
      schema: z.object({
        title: z.string().min(1).max(255).optional(),
        sourceType: z.enum(TOPIC_SOURCE_TYPES).optional(),
        sourceUrl: z.string().url().nullable().optional(),
        sourcePostId: z.number().int().positive().nullable().optional(),
        originalIdea: z.string().max(10_000).nullable().optional(),
        coreAngle: z.string().max(10_000).nullable().optional(),
        keyPoints: z.array(z.string().min(1).max(1000)).max(30).nullable().optional(),
        status: z.enum(TOPIC_STATUSES).optional(),
      }),
    },
  );
}
