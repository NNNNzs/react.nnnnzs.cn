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
import { getPostById } from '@/services/post';
import type { Tool, ToolResult } from '../index';

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
