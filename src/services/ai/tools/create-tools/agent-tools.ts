import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  createContentAsset,
  getContentDraft,
  type DraftImageItem,
} from '@/services/content-creation';
import { serializeToolData, serializeToolError } from '../tool-result';
import type { DraftPatch } from './draft-patch';

export interface CurrentDraftToolContext {
  draftId: number;
  /** 已在 API 路由完成资源权限校验的实际操作者。 */
  actorUserId: number;
}

export interface EmitDraftPatchToolContext extends CurrentDraftToolContext {
  emitPatch: (patch: DraftPatch) => void;
}

export function createGetCurrentDraftTool(context: CurrentDraftToolContext) {
  return tool(
    async () => {
      try {
        const draft = await getContentDraft(context.draftId);
        if (!draft) {
          return serializeToolData({ error: `草稿 ${context.draftId} 不存在` });
        }

        return serializeToolData({
          id: draft.id,
          title: draft.title,
          hook: draft.hook,
          body: draft.body,
          type: draft.type,
          status: draft.status,
          platform: draft.platform,
          tags: draft.tags_json,
          slides: draft.slides.map((slide) => ({
            id: slide.id,
            sortOrder: slide.sort_order,
            title: slide.title,
            bullets: slide.bullets_json,
            prompt: slide.prompt,
          })),
          selectedImages: (draft.selected_images as DraftImageItem[]).map((image) => ({
            id: image.id,
            assetId: image.assetId,
            title: image.title,
            imageUrl: image.imageUrl,
            group: image.group,
            sortOrder: image.sortOrder,
            remark: image.remark,
          })),
        });
      } catch (error) {
        return serializeToolError(error, '读取草稿失败');
      }
    },
    {
      name: 'get_current_draft',
      description: '读取当前请求已授权草稿的标题、正文、图卡和已选图片，无需参数。',
      schema: z.object({}),
    },
  );
}

export function createEmitDraftPatchTool(context: EmitDraftPatchToolContext) {
  return tool(
    async (rawPatch) => {
      try {
        const patch: DraftPatch = { ...rawPatch };

        if (patch.addImages && patch.addImages.length > 0) {
          patch.addImages = await Promise.all(
            patch.addImages.map(async (image) => {
              if (image.assetId || !image.imageUrl) return image;
              const asset = await createContentAsset({
                type: 'image',
                draft_id: context.draftId,
                title: image.title ?? null,
                usage: image.group ?? null,
                cdn_url: image.imageUrl,
                created_by: context.actorUserId,
              });
              return { ...image, assetId: asset.id };
            }),
          );
        }

        context.emitPatch(patch);
        const fields = Object.keys(patch).filter((key) => key !== 'addImages');
        const imageCount = patch.addImages?.length ?? 0;
        return serializeToolData({
          ok: true,
          message: `已提交待确认字段 [${fields.join(', ')}]${imageCount ? `，建议追加 ${imageCount} 张图片` : ''}。提醒用户先确认建议再保存。`,
        });
      } catch (error) {
        return serializeToolError(error, 'emit_draft_patch 失败');
      }
    },
    {
      name: 'emit_draft_patch',
      description: '把草稿字段建议提交给前端等待用户确认，不直接写入草稿。',
      returnDirect: true,
      schema: z.object({
        title: z.string().optional().describe('新标题'),
        hook: z.string().optional().describe('钩子文案'),
        body: z.string().optional().describe('正文 Markdown'),
        tags: z.array(z.string()).optional().describe('标签数组'),
        status: z
          .enum(['DRAFT', 'ASSET_PENDING', 'READY', 'PUBLISHED', 'ARCHIVED'])
          .optional()
          .describe('草稿状态'),
        addImages: z
          .array(z.object({
            imageUrl: z.string().describe('图片 CDN URL'),
            title: z.string().optional().describe('图片备注或标题'),
            group: z.string().optional().describe('分组名，如 cover'),
          }))
          .optional()
          .describe('要追加到草稿的图片'),
        slides: z.array(z.object({
          title: z.string().optional().describe('图卡标题'),
          bullets: z.array(z.string()).optional().describe('图卡要点'),
          prompt: z.string().min(1).describe('该图卡的图片生成提示词'),
        })).max(12).optional().describe('图卡计划与图片提示词'),
      }),
    },
  );
}
