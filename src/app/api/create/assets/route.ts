import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_VIEW, CONTENT_CREATE } from '@/constants/permissions';
import {
  createLinkedContentImageAsset,
  listContentAssets,
  type ContentAssetSource,
} from '@/services/content-creation';
import {
  getNumberParam,
  getStringParam,
  validationErrorResponse,
} from '../_utils';

const createAssetSchema = z.object({
  image_url: z.string().trim().url('请输入有效的图片地址').max(5000, '图片地址过长')
    .refine((value) => value.startsWith('https://'), '图片地址必须以 https:// 开头'),
  title: z.string().trim().max(255).optional().nullable(),
  group: z.string().trim().max(60).optional().nullable(),
});

function getSourceParam(value: string | null): ContentAssetSource | undefined {
  return value === 'generated' || value === 'uploaded' ? value : undefined;
}

function getBooleanParam(value: string | null) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const scopeAll = hasDataPermission(check.user, CONTENT_VIEW);
    const searchParams = request.nextUrl.searchParams;
    const result = await listContentAssets({
      pageNum: getNumberParam(searchParams.get('pageNum')),
      pageSize: getNumberParam(searchParams.get('pageSize')),
      query: getStringParam(searchParams.get('query')),
      group: getStringParam(searchParams.get('group')) ?? getStringParam(searchParams.get('usage')),
      source: getSourceParam(searchParams.get('source')),
      favorite: getBooleanParam(searchParams.get('favorite')),
      draftId: getNumberParam(searchParams.get('draftId')),
      topicId: getNumberParam(searchParams.get('topicId')),
      userId: scopeAll ? undefined : check.user.id,
    });

    return NextResponse.json(successResponse(result), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('获取内容素材失败:', error);
    return NextResponse.json(errorResponse('获取内容素材失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_CREATE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createAssetSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const data = validation.data;
    const asset = await createLinkedContentImageAsset({
      title: data.title,
      group: data.group,
      imageUrl: data.image_url,
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(asset, '图片素材已添加'), {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('创建内容素材失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建内容素材失败'),
      { status: 500 },
    );
  }
}
