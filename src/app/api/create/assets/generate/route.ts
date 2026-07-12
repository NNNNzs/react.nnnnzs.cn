import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONTENT_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { createImageGenerationJob } from '@/services/image-gen-job';
import {
  createGeneratedContentImageAsset,
  getContentImageAssetsByIds,
} from '@/services/content-creation';
import type { ImageGenOptions } from '@/services/image-gen';
import { validationErrorResponse } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

const generateAssetSchema = z.object({
  mode: z.enum(['generate', 'edit']).default('generate'),
  prompt: z.string().min(1, '提示词不能为空').max(32000, '提示词过长'),
  image: z.string().max(5000).optional(),
  images: z.array(z.string().min(1).max(5000)).max(10).optional(),
  reference_asset_ids: z.array(z.coerce.number().int().positive()).max(10).optional(),
  title: z.string().max(255).optional().nullable(),
  group: z.string().max(60).optional().nullable(),
});

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = generateAssetSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const data = validation.data;
    const referencedAssets = data.reference_asset_ids?.length
      ? await getContentImageAssetsByIds(data.reference_asset_ids)
      : [];
    const referenceImageUrls = uniqueStrings([
      ...(data.image ? [data.image] : []),
      ...(data.images ?? []),
      ...referencedAssets
        .map((asset) => asset.cdn_url)
        .filter((url): url is string => Boolean(url)),
    ]);

    if (data.mode === 'edit' && referenceImageUrls.length === 0) {
      return NextResponse.json(errorResponse('图文编辑需要至少选择一张母图'), { status: 400 });
    }

    const options: ImageGenOptions = {
      mode: data.mode,
      prompt: data.prompt.trim(),
      ...(data.mode === 'edit'
        ? { image: referenceImageUrls[0], images: referenceImageUrls }
        : {}),
    };

    const job = await createImageGenerationJob({
      options,
      userId: check.user.id,
      source: 'ADMIN',
      group: data.group || undefined,
    });

    const asset = await createGeneratedContentImageAsset({
      job,
      options,
      title: data.title,
      group: data.group,
      referenceAssetIds: data.reference_asset_ids,
      created_by: check.user.id,
    });

    return NextResponse.json(
      successResponse({ asset, job }, '图片生成任务已加入素材库'),
      {
        status: 202,
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (error) {
    console.error('创建素材图片生成任务失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建素材图片生成任务失败'),
      { status: 500 },
    );
  }
}
