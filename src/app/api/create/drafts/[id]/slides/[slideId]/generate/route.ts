import { NextRequest, NextResponse } from 'next/server';
import { CONTENT_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import {
  addContentDraftImage,
  attachContentDraftSlideAsset,
  createContentAsset,
  getContentDraft,
} from '@/services/content-creation';
import { createImageGenerationJob } from '@/services/image-gen-job';

interface RouteContext {
  params: Promise<{ id: string; slideId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status });
    const { id, slideId } = await context.params;
    const draftId = Number(id);
    const parsedSlideId = Number(slideId);
    if (!Number.isInteger(draftId) || draftId <= 0 || !Number.isInteger(parsedSlideId) || parsedSlideId <= 0) {
      return NextResponse.json(errorResponse('草稿或图卡 ID 无效'), { status: 400 });
    }
    const draft = await getContentDraft(draftId);
    if (!draft) return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_EDIT, draft.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }
    const slide = draft.slides.find((item) => item.id === parsedSlideId);
    if (!slide?.prompt?.trim()) return NextResponse.json(errorResponse('图卡缺少图片提示词'), { status: 400 });

    const job = await createImageGenerationJob({
      options: { mode: 'generate', prompt: slide.prompt },
      userId: check.user.id,
      source: 'ADMIN',
      group: 'draft-slide',
    });
    const asset = await createContentAsset({
      draft_id: draftId,
      type: 'image',
      usage: 'draft-slide',
      title: slide.title ?? `图卡 ${slide.sort_order}`,
      cdn_url: job.reservedCdnUrl,
      cos_key: job.cosKey,
      ai_job_id: job.id,
      created_by: check.user.id,
    });
    await attachContentDraftSlideAsset(draftId, parsedSlideId, asset.id);
    const result = await addContentDraftImage(draftId, asset.id);
    return NextResponse.json(successResponse({ draft: result, job }, '图卡图片已提交生成并已关联草稿'), {
      status: 202,
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('生成图卡图片失败:', error);
    return NextResponse.json(errorResponse(error instanceof Error ? error.message : '生成图卡图片失败'), { status: 500 });
  }
}
