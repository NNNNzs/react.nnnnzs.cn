import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_DELETE, CONTENT_EDIT, CONTENT_VIEW } from '@/constants/permissions';
import { deleteContentImageAsset, getContentImageAsset, updateContentImageAsset } from '@/services/content-creation';
import { getPrisma } from '@/lib/prisma';
import { validationErrorResponse } from '../../_utils';
import type { ApiDescriptor } from '@/types/api-descriptor';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const updateAssetSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  group: z.string().max(60).optional().nullable(),
  is_favorite: z.boolean().optional(),
});

const assetIdInputSchema = { id: { type: 'number', description: '素材 ID' } };

export const getDescriptor: ApiDescriptor = {
  code: 'create_assets_get', name: '素材详情', description: '按 ID 获取图片素材及关联的生成任务信息。',
  module: 'content', method: 'GET', permissionCode: CONTENT_VIEW,
  inputSchema: { type: 'object', properties: assetIdInputSchema, required: ['id'] },
};

export const updateDescriptor: ApiDescriptor = {
  code: 'create_assets_update', name: '更新素材', description: '更新图片素材的名称、分组或收藏状态，不修改 CDN 地址。',
  module: 'content', method: 'PATCH', permissionCode: CONTENT_EDIT,
  inputSchema: {
    type: 'object',
    properties: {
      ...assetIdInputSchema,
      title: { type: 'string', description: '素材名称；传空字符串可清空' },
      group: { type: 'string', description: '素材分组；传空字符串可清空' },
      is_favorite: { type: 'boolean', description: '是否收藏' },
    },
    required: ['id'],
  },
};

export const deleteDescriptor: ApiDescriptor = {
  code: 'create_assets_delete', name: '删除素材', description: '按 ID 删除一条图片素材记录。',
  module: 'content', method: 'DELETE', permissionCode: CONTENT_DELETE,
  inputSchema: { type: 'object', properties: assetIdInputSchema, required: ['id'] },
};

async function readAssetId(context: RouteContext) {
  const { id } = await context.params;
  const assetId = Number(id);
  return Number.isInteger(assetId) && assetId > 0 ? assetId : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status });
    const assetId = await readAssetId(context);
    if (!assetId) return NextResponse.json(errorResponse('无效的素材 ID'), { status: 400 });
    const asset = await getContentImageAsset(assetId);
    if (!asset) return NextResponse.json(errorResponse('图片素材不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_VIEW, asset.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }
    return NextResponse.json(successResponse(asset), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('获取图片素材失败:', error);
    return NextResponse.json(errorResponse('获取图片素材失败'), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const assetId = await readAssetId(context);
    if (!assetId) {
      return NextResponse.json(errorResponse('无效的素材 ID'), { status: 400 });
    }

    const prisma = await getPrisma();
    const existing = await prisma.contentAsset.findFirst({
      where: { id: assetId, type: 'image' },
      select: { created_by: true },
    });
    if (!existing) {
      return NextResponse.json(errorResponse('图片素材不存在'), { status: 404 });
    }
    if (!hasDataPermission(check.user, CONTENT_EDIT, existing.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    const validation = updateAssetSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const asset = await updateContentImageAsset(assetId, {
      title: validation.data.title,
      group: validation.data.group,
      isFavorite: validation.data.is_favorite,
    });

    if (!asset) {
      return NextResponse.json(errorResponse('图片素材不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(asset, '图片素材已更新'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('更新图片素材失败:', error);
    return NextResponse.json(errorResponse('更新图片素材失败'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_DELETE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const assetId = await readAssetId(context);
    if (!assetId) {
      return NextResponse.json(errorResponse('无效的素材 ID'), { status: 400 });
    }

    const prisma = await getPrisma();
    const existing = await prisma.contentAsset.findFirst({
      where: { id: assetId, type: 'image' },
      select: { created_by: true },
    });
    if (!existing) {
      return NextResponse.json(errorResponse('图片素材不存在'), { status: 404 });
    }
    if (!hasDataPermission(check.user, CONTENT_DELETE, existing.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    await deleteContentImageAsset(assetId);
    return NextResponse.json(successResponse(null, '图片素材已删除'), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('删除图片素材失败:', error);
    return NextResponse.json(errorResponse('删除图片素材失败'), { status: 500 });
  }
}
