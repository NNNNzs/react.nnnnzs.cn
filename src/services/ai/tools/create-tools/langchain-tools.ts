/**
 * 创作助手 LangChain 工具包装层
 *
 * 通过 buildCreateTools 工厂按请求构建工具数组，注入 draftId / userId / emitPatch 上下文。
 * 与 chat-agent 的静态 chatTools 不同：这里每次对话都重新构造，避免跨草稿上下文泄漏。
 *
 * 工具 execute 必须返回 string（LangChain tool calling 约定）。
 */

import { tool } from '@langchain/core/tools';
import { tavily } from '@tavily/core';
import { z } from 'zod';
import type { StructuredTool } from '@langchain/core/tools';
import { getAIConfigValue } from '@/lib/ai-config';
import { createContentAsset } from '@/services/content-creation';
import {
  listPromptSkillsTool,
  loadPromptSkillTemplateTool,
  createGetDraftTool,
  getPostContentTool,
} from './index';
import { searchPostsMetaTool as _searchPostsMetaTool } from '../search-posts-meta';
import type { DraftPatch } from './draft-patch';

export interface BuildCreateToolsParams {
  draftId: number;
  userId: number;
  /** emit_draft_patch 工具被调用时触发，把 patch 推到 SSE 流 */
  emitPatch: (patch: DraftPatch) => void;
}

export function buildCreateTools(params: BuildCreateToolsParams): StructuredTool[] {
  const { draftId, userId, emitPatch } = params;

  const listPromptSkills = wrapListPromptSkills();
  const loadPromptSkillTemplate = wrapLoadPromptSkillTemplate();
  const getDraft = wrapGetDraft(draftId);
  const searchPosts = wrapSearchPosts();
  const getPostContent = wrapGetPostContent();
  const webSearch = wrapWebSearch();
  const emitDraftPatch = wrapEmitDraftPatch(emitPatch, userId, draftId);

  return [
    listPromptSkills,
    loadPromptSkillTemplate,
    getDraft,
    searchPosts,
    getPostContent,
    webSearch,
    emitDraftPatch,
  ];
}

/* ---------- 包装函数 ---------- */

function wrapListPromptSkills(): StructuredTool {
  return tool(
    async ({ query, type }) => {
      const result = await listPromptSkillsTool.execute({ query, type });
      return JSON.stringify(result.success ? result.data : { error: result.error });
    },
    {
      name: 'list_prompt_skills',
      description:
        '列出可按需加载的 Prompt / Skill 模板 metadata。只返回摘要，不返回完整正文。需要确认有哪些风格指南、写作指南、提示词模板可用时先用它。',
      schema: z.object({
        query: z.string().optional().describe('模板名称、slug、描述关键词'),
        type: z
          .enum(['prompt', 'skill', 'style', 'context', 'tool_instruction', 'schema', 'checklist'])
          .optional()
          .describe('模板类型筛选'),
      }),
    },
  );
}

function wrapLoadPromptSkillTemplate(): StructuredTool {
  return tool(
    async ({ slug, version, variables }) => {
      const result = await loadPromptSkillTemplateTool.execute({ slug, version, variables });
      return JSON.stringify(result.success ? result.data : { error: result.error });
    },
    {
      name: 'load_prompt_skill_template',
      description:
        '按 slug 加载 Prompt / Skill 模板完整正文。只有确实需要完整指南、方法论或模板内容时才调用；例如 slug=xhs-style-guide 可加载小红书风格指南原文。',
      schema: z.object({
        slug: z.string().min(1).describe('模板 slug，如 xhs-style-guide'),
        version: z.number().int().positive().optional().describe('指定版本号；不传读取当前激活版本'),
        variables: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('可选 LangChain mustache 渲染变量对象'),
      }),
    },
  );
}

function wrapGetDraft(draftId: number): StructuredTool {
  const getDraftTool = createGetDraftTool(draftId);
  return tool(
    async () => {
      const result = await getDraftTool.execute({});
      return JSON.stringify(result.success ? result.data : { error: result.error });
    },
    {
      name: 'get_draft',
      description: '读取当前正在编辑的草稿（标题、hook、正文、标签、图卡、已选图片），无需参数。',
      schema: z.object({}),
    },
  );
}

function wrapSearchPosts(): StructuredTool {
  return tool(
    async ({ keyword, limit, tags }) => {
      const result = await _searchPostsMetaTool.execute({
        keyword,
        limit: limit ?? 5,
        tags,
      });
      return JSON.stringify(result.success ? result.data : { error: result.error });
    },
    {
      name: 'search_posts',
      description:
        '按关键词 / 标签检索博客文章列表（返回 id、标题、摘要、标签、日期）。用于把博客作为创作素材时先找到候选文章。',
      schema: z.object({
        keyword: z.string().describe('标题和描述的关键词'),
        tags: z.string().optional().describe('标签筛选，逗号分隔，如 "AI,前端"'),
        limit: z.number().optional().describe('返回数量，默认 5'),
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
      description: '按文章 ID 读取博客全文（Markdown），作为创作素材。',
      schema: z.object({
        postId: z.number().int().describe('博客文章 ID'),
      }),
    },
  );
}

function wrapWebSearch(): StructuredTool {
  return tool(
    async ({ query, searchDepth }) => {
      try {
        const apiKey = (await getAIConfigValue('TAVILY_API_KEY'))?.trim();
        if (!apiKey) {
          return JSON.stringify({ error: 'TAVILY_API_KEY 未配置' });
        }

        const client = tavily({ apiKey });
        const result = await client.search(query, {
          searchDepth,
        });

        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : '网页搜索失败',
        });
      }
    },
    {
      name: 'web_search',
      description: '在网页上搜索最新或外部信息。需要联网检索资料、核实事实、补充当前信息时使用。',
      schema: z.object({
        query: z.string().min(1).describe('需要联网搜索的关键词'),
        searchDepth: z.enum(['basic', 'advanced']).describe('搜索深度，basic 或 advanced'),
      }),
    },
  );
}

/**
 * emit_draft_patch：伪工具。
 * 模型以为在修改草稿，实际只通过 emitPatch 推送结构化 patch 到前端待确认。
 * 若 patch 含 addImages 且只给了 cdnUrl（无 assetId），此处自动入库为素材并补上 assetId。
 */
function wrapEmitDraftPatch(
  emitPatch: (patch: DraftPatch) => void,
  userId: number,
  draftId: number,
): StructuredTool {
  return tool(
    async (rawPatch) => {
      try {
        const patch: DraftPatch = { ...rawPatch };

        // 把只有 cdnUrl 的图片入库为素材，补上 assetId
        if (patch.addImages && patch.addImages.length > 0) {
          const enriched = await Promise.all(
            patch.addImages.map(async (img) => {
              if (img.assetId) return img;
              if (!img.imageUrl) return img;
              const asset = await createContentAsset({
                type: 'image',
                draft_id: draftId,
                title: img.title ?? null,
                usage: img.group ?? null,
                cdn_url: img.imageUrl,
                created_by: userId,
              });
              return { ...img, assetId: asset.id };
            }),
          );
          patch.addImages = enriched;
        }

        emitPatch(patch);
        const fields = Object.keys(patch).filter((k) => k !== 'addImages');
        const imgCount = patch.addImages?.length ?? 0;
        return JSON.stringify({
          ok: true,
          message: `已提交待确认字段 [${fields.join(', ')}]${imgCount ? `，建议追加 ${imgCount} 张图片` : ''}。提醒用户先确认建议再保存。`,
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'emit_draft_patch 失败',
        });
      }
    },
    {
      name: 'emit_draft_patch',
      description:
        '把建议写进草稿的内容以结构化 patch 提交给前端待确认。修改草稿（标题/hook/正文/标签/状态/追加图片）必须用此工具，不要只在对话里贴文本。写权限在用户手里，用户确认应用并点保存才落库。',
      // 这是创作建议这一轮的终点：补丁交给页面后，必须等用户确认，
      // 不能把工具结果再交回模型继续调用 generate_image / poll_image_job。
      returnDirect: true,
      schema: z.object({
        title: z.string().optional().describe('新标题'),
        hook: z.string().optional().describe('钩子文案'),
        body: z.string().optional().describe('正文（Markdown）'),
        tags: z.array(z.string()).optional().describe('标签数组'),
        status: z
          .enum(['DRAFT', 'ASSET_PENDING', 'READY', 'PUBLISHED', 'ARCHIVED'])
          .optional()
          .describe('草稿状态'),
        addImages: z
          .array(
            z.object({
              imageUrl: z.string().describe('图片 CDN URL（来自 poll_image_job 的 cdnUrl）'),
              title: z.string().optional().describe('图片备注/标题'),
              group: z.string().optional().describe('分组名，如 cover'),
            }),
          )
          .optional()
          .describe('要追加到草稿的图片'),
        slides: z.array(z.object({
          title: z.string().optional().describe('图卡标题'),
          bullets: z.array(z.string()).optional().describe('图卡要点'),
          prompt: z.string().min(1).describe('该图卡的图片生成提示词，只做计划，不直接出图'),
        })).max(12).optional().describe('图文草稿的图卡计划与图片提示词'),
      }),
    },
  );
}
