/**
 * 创作助手工具业务层
 *
 * 只包含无副作用或只读的业务逻辑。写草稿不走工具，由 emit_draft_patch 事件
 * 触发前端表单填充（方案 B）。
 */

import {
  listContentTemplates,
  getContentDraft,
  type DraftImageItem,
} from '@/services/content-creation';
import {
  listAiTemplates,
  loadPromptSkillTemplate,
} from '@/services/ai-template';
import { getPostById } from '@/services/post';
import type { Tool, ToolResult } from '../index';

const LEGACY_SCENARIO_TO_SLUG: Record<string, string> = {
  blog_to_xhs_note: 'xhs-blog-to-note',
  blog_to_short_video: 'xhs-blog-to-short-video',
  tts: 'xhs-mimo-tts-style',
  content_agent: 'agent-create-agent-system',
};

export const listPromptSkillsTool: Tool = {
  name: 'list_prompt_skills',
  description:
    '列出可按需加载的 Prompt / Skill 模板 metadata。只返回摘要，不返回完整正文，用于决定是否需要进一步读取。',
  parameters: {
    query: {
      type: 'string',
      description: '模板名称、slug、描述关键词',
      required: false,
    },
    type: {
      type: 'string',
      description: '模板类型：prompt / skill / style / context / tool_instruction / schema / checklist',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const { record } = await listAiTemplates({
        query: (args.query as string) || undefined,
        type: (args.type as string) || undefined,
        status: 'ACTIVE',
        pageNum: 1,
        pageSize: 20,
      });

      return {
        success: true,
        data: {
          templates: record.map((item) => ({
            slug: item.slug,
            key: item.key,
            name: item.name,
            type: item.type,
            scope: item.scope,
            description: item.description,
            aliases: item.aliases,
            currentVersion: item.current_version,
            metadata: item.metadata_json,
            loadTool: 'load_prompt_skill_template',
          })),
          message: `找到 ${record.length} 个可用模板`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询 Prompt Skill 失败',
      };
    }
  },
};

export const loadPromptSkillTemplateTool: Tool = {
  name: 'load_prompt_skill_template',
  description:
    '按 slug 加载 Prompt / Skill 模板完整正文。只有确实需要完整指南、方法论或模板内容时才调用。',
  parameters: {
    slug: {
      type: 'string',
      description: '模板 slug，如 xhs-style-guide',
      required: true,
    },
    version: {
      type: 'number',
      description: '指定版本号；不传则读取当前激活版本',
      required: false,
    },
    variables: {
      type: 'object',
      description: '可选的 LangChain mustache 渲染变量对象',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const slug = String(args.slug || '').trim();
      if (!slug) return { success: false, error: 'slug 不能为空' };

      const variables = args.variables && typeof args.variables === 'object' && !Array.isArray(args.variables)
        ? args.variables as Record<string, unknown>
        : undefined;
      const data = await loadPromptSkillTemplate({
        slug,
        version: typeof args.version === 'number' ? args.version : undefined,
        variables,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '加载 Prompt Skill 失败',
      };
    }
  },
};

/** 读取指定 scenario 的提示词模板正文 */
export const readPromptTemplateTool: Tool = {
  name: 'read_prompt_template',
  description:
    '读取内容模板库中的提示词正文。当需要按某套方法论（如博客转小红书图文）产出内容时，先读对应模板。',
  parameters: {
    scenario: {
      type: 'string',
      description:
        '模板场景：blog_to_xhs_note（博客转小红书图文）、blog_to_short_video（转短视频脚本）、tts（语音风格）、image_card（图卡）、content_agent（助手 system prompt）',
      required: false,
    },
    name: {
      type: 'string',
      description: '模板名称关键词（模糊匹配），与 scenario 二选一或组合使用',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const scenario = (args.scenario as string) || undefined;
      const query = (args.name as string) || undefined;
      const slug = scenario ? LEGACY_SCENARIO_TO_SLUG[scenario] : undefined;

      if (slug) {
        const data = await loadPromptSkillTemplate({ slug });
        return {
          success: true,
          data: {
            templates: [{
              id: data.template.id,
              name: data.template.name,
              scenario,
              type: data.template.type,
              content: data.version.content,
              variables: data.version.metadata_json,
              outputSchema: data.template.metadata_json,
              slug: data.template.slug,
              version: data.version.version,
            }],
            message: '找到 1 个模板',
          },
        };
      }

      const { record } = await listContentTemplates({
        scenario,
        status: 'ACTIVE',
        query,
        pageNum: 1,
        pageSize: 3,
      });

      if (record.length === 0) {
        return { success: false, error: '未找到匹配的模板' };
      }

      return {
        success: true,
        data: {
          templates: record.map((t) => ({
            id: t.id,
            name: t.name,
            scenario: t.scenario,
            type: t.type,
            content: t.content,
            variables: t.variables_json,
            outputSchema: t.output_schema_json,
          })),
          message: `找到 ${record.length} 个模板`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取模板失败',
      };
    }
  },
};

/** 创建读取当前草稿的工具（闭包注入 draftId） */
export function createGetDraftTool(draftId: number): Tool {
  return {
    name: 'get_draft',
    description:
      '读取当前正在编辑的草稿：标题、hook、正文、标签、状态、图卡（slides）、已选图片。无需参数。',
    parameters: {},
    async execute(): Promise<ToolResult> {
      try {
        const draft = await getContentDraft(draftId);
        if (!draft) {
          return { success: false, error: `草稿 ${draftId} 不存在` };
        }
        return {
          success: true,
          data: {
            id: draft.id,
            title: draft.title,
            hook: draft.hook,
            body: draft.body,
            type: draft.type,
            status: draft.status,
            platform: draft.platform,
            tags: draft.tags_json,
            slides: draft.slides.map((s) => ({
              id: s.id,
              sortOrder: s.sort_order,
              title: s.title,
              bullets: s.bullets_json,
              prompt: s.prompt,
            })),
            selectedImages: (draft.selected_images as DraftImageItem[]).map((img) => ({
              id: img.id,
              assetId: img.assetId,
              title: img.title,
              imageUrl: img.imageUrl,
              group: img.group,
              sortOrder: img.sortOrder,
              remark: img.remark,
            })),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '读取草稿失败',
        };
      }
    },
  };
}

/** 读取指定博客文章全文（用于把博客内容作为创作素材） */
export const getPostContentTool: Tool = {
  name: 'get_post_content',
  description: '按文章 ID 读取博客全文（Markdown）。用于把某篇博客作为创作素材时获取正文。',
  parameters: {
    postId: {
      type: 'number',
      description: '博客文章 ID',
      required: true,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const postId = Number(args.postId);
      if (!Number.isFinite(postId)) {
        return { success: false, error: 'postId 无效' };
      }
      const post = await getPostById(postId);
      if (!post) {
        return { success: false, error: `文章 ${postId} 不存在` };
      }
      return {
        success: true,
        data: {
          id: post.id,
          title: post.title,
          path: post.path,
          description: post.description,
          tags: post.tags,
          category: post.category,
          content: post.content,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取文章失败',
      };
    }
  },
};
