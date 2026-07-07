import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import { updateContentImageAsset } from '@/services/content-creation';
import { validationErrorResponse } from '../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateAssetSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  group: z.string().max(60).optional().nullable(),
  is_favorite: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const assetId = Number(id);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return NextResponse.json(errorResponse('无效的素材 ID'), { status: 400 });
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
