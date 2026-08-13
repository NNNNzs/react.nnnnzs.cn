import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { CONTENT_EDIT, CONTENT_VIEW } from '@/constants/permissions';
import { hasDataPermission, requirePermission } from '@/lib/permission';
import { getContentDraft } from '@/services/content-creation';
import {
  createContentDraftPreviewShare,
  listContentDraftPreviewShares,
  revokeContentDraftPreviewShares,
} from '@/services/content-draft-preview';
import { validationErrorResponse } from '../../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createShareSchema = z.object({
  expiresAt: z.coerce.date().nullable().optional(),
  rotate: z.boolean().optional(),
});

async function readAuthorizedDraft(request: NextRequest, context: RouteContext, permission: string) {
  const check = await requirePermission(request, permission);
  if ('error' in check) return { response: NextResponse.json(errorResponse(check.error), { status: check.status }) };
  const { id } = await context.params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId) || draftId <= 0) {
    return { response: NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 }) };
  }
  const draft = await getContentDraft(draftId);
  if (!draft) return { response: NextResponse.json(errorResponse('草稿不存在'), { status: 404 }) };
  if (!hasDataPermission(check.user, permission, draft.created_by)) {
    return { response: NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 }) };
  }
  return { draftId, userId: check.user.id };
}

const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authorized = await readAuthorizedDraft(request, context, CONTENT_VIEW);
    if ('response' in authorized) return authorized.response;
    const shares = await listContentDraftPreviewShares(authorized.draftId);
    return NextResponse.json(successResponse(shares), { headers: noStoreHeaders });
  } catch (error) {
    console.error('获取草稿公开预览分享失败:', error);
    return NextResponse.json(errorResponse('获取草稿公开预览分享失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authorized = await readAuthorizedDraft(request, context, CONTENT_EDIT);
    if ('response' in authorized) return authorized.response;
    const validation = createShareSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);
    if (validation.data.expiresAt && validation.data.expiresAt <= new Date()) {
      return NextResponse.json(errorResponse('过期时间必须晚于当前时间'), { status: 400 });
    }
    const { token, share } = await createContentDraftPreviewShare({
      draftId: authorized.draftId,
      createdBy: authorized.userId,
      expiresAt: validation.data.expiresAt,
      rotate: validation.data.rotate,
    });
    return NextResponse.json(successResponse({
      share,
      // Token only exists in this response; database stores its SHA-256 hash.
      urls: ['xhs', 'zhihu', 'toutiao'].map((mode) => `/preview?share=${encodeURIComponent(token)}&mode=${mode}`),
    }, '公开预览链接已创建'), { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error('创建草稿公开预览分享失败:', error);
    return NextResponse.json(errorResponse('创建草稿公开预览分享失败'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authorized = await readAuthorizedDraft(request, context, CONTENT_EDIT);
    if ('response' in authorized) return authorized.response;
    const revokedCount = await revokeContentDraftPreviewShares(authorized.draftId);
    return NextResponse.json(successResponse({ revokedCount }, '公开预览链接已撤销'), { headers: noStoreHeaders });
  } catch (error) {
    console.error('撤销草稿公开预览分享失败:', error);
    return NextResponse.json(errorResponse('撤销草稿公开预览分享失败'), { status: 500 });
  }
}
