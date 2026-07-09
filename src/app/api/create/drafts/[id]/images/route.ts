import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_EDIT } from '@/constants/permissions';
import {
  addContentDraftImage,
  removeContentDraftImage,
  updateContentDraftImages,
  getContentDraft,
} from '@/services/content-creation';
import { getStringParam, validationErrorResponse } from '../../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const addDraftImageSchema = z.object({
  asset_id: z.coerce.number().int().positive(),
});

const updateDraftImagesSchema = z.object({
  images: z.array(z.object({
    id: z.string().min(1),
    sort_order: z.coerce.number().int().positive(),
    remark: z.string().max(500).optional().nullable(),
  })).max(100),
});

async function readDraftId(context: RouteContext) {
  const { id } = await context.params;
  const draftId = Number(id);
  return Number.isInteger(draftId) && draftId > 0 ? draftId : null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const draftId = await readDraftId(context);
    if (!draftId) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const owner = await getContentDraft(draftId);
    if (!owner) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }

    if (!hasDataPermission(check.user, CONTENT_EDIT, owner.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    const validation = addDraftImageSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const draft = await addContentDraftImage(draftId, validation.data.asset_id);
    return NextResponse.json(successResponse(draft, '图片已添加到草稿'), {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('添加草稿图片失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '添加草稿图片失败'),
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const draftId = await readDraftId(context);
    if (!draftId) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const owner = await getContentDraft(draftId);
    if (!owner) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }

    if (!hasDataPermission(check.user, CONTENT_EDIT, owner.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    const imageId = getStringParam(request.nextUrl.searchParams.get('imageId'));
    if (!imageId) {
      return NextResponse.json(errorResponse('imageId 参数缺失'), { status: 400 });
    }

    const draft = await removeContentDraftImage(draftId, imageId);
    return NextResponse.json(successResponse(draft, '图片已移出草稿'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('移除草稿图片失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '移除草稿图片失败'),
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const draftId = await readDraftId(context);
    if (!draftId) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const owner = await getContentDraft(draftId);
    if (!owner) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }

    if (!hasDataPermission(check.user, CONTENT_EDIT, owner.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    const validation = updateDraftImagesSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const draft = await updateContentDraftImages(
      draftId,
      validation.data.images.map((image) => ({
        id: image.id,
        sortOrder: image.sort_order,
        remark: image.remark,
      })),
    );
    return NextResponse.json(successResponse(draft, '草稿图片已保存'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('保存草稿图片失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '保存草稿图片失败'),
      { status: 500 },
    );
  }
}
