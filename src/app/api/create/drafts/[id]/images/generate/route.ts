import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONTENT_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { hasDataPermission, requirePermission } from '@/lib/permission';
import {
  generateContentDraftImage,
  getContentDraft,
} from '@/services/content-creation';
import type { ApiDescriptor } from '@/types/api-descriptor';
import { validationErrorResponse } from '../../../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const generateDraftImageSchema = z.object({
  prompt: z.string().trim().min(1, '提示词不能为空').max(32000, '提示词过长'),
  image: z.string().trim().min(1).max(5000).optional(),
  images: z.array(z.string().trim().min(1).max(5000)).max(10).optional(),
  title: z.string().trim().max(255).optional().nullable(),
  group: z.string().trim().max(60).optional().nullable(),
});

export const descriptor: ApiDescriptor = {
  code: 'create_draft_images_generate',
  name: '为草稿生成配图',
  description: '为指定草稿创建 AI 图片生成或编辑任务，自动保存到素材库并立即关联草稿。',
  module: 'content',
  method: 'POST',
  permissionCode: CONTENT_EDIT,
  inputSchema: {
    type: 'object',
    properties: {
      draft_id: { type: 'number', description: '目标草稿 ID' },
      prompt: { type: 'string', description: '图片提示词或编辑指令' },
      image: { type: 'string', description: '可选参考图片 URL' },
      images: { type: 'array', items: { type: 'string' }, description: '可选参考图片 URL 列表' },
      title: { type: 'string', description: '素材名称，可选' },
      group: { type: 'string', description: '图片用途或素材分组，如 cover、正文配图，可选' },
    },
    required: ['draft_id', 'prompt'],
  },
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const draftId = Number(id);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const draft = await getContentDraft(draftId);
    if (!draft) return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_EDIT, draft.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    const validation = generateDraftImageSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const result = await generateContentDraftImage({
      draftId,
      options: {
        prompt: validation.data.prompt,
        image: validation.data.image,
        images: validation.data.images,
      },
      title: validation.data.title,
      group: validation.data.group,
      createdBy: check.user.id,
      source: 'ADMIN',
    });

    return NextResponse.json(successResponse(result, '图片已提交生成并关联草稿'), {
      status: 202,
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('为草稿生成图片失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '为草稿生成图片失败'),
      { status: 500 },
    );
  }
}
