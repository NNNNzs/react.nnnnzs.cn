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
import type { ApiDescriptor } from '@/types/api-descriptor';

export const createAssetSchema = z.object({
  image_url: z.string().trim().url('请输入有效的图片地址').max(5000, '图片地址过长')
    .refine((value) => value.startsWith('https://'), '图片地址必须以 https:// 开头'),
  title: z.string().trim().max(255).optional().nullable(),
  group: z.string().trim().max(60).optional().nullable(),
});

export const getDescriptor: ApiDescriptor = {
  code: 'create_assets_list', name: '素材列表', description: '分页查询图片素材，可按关键词、分组、来源、收藏、草稿或选题筛选。',
  module: 'content', method: 'GET', permissionCode: CONTENT_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码，默认 1' },
      pageSize: { type: 'number', description: '每页数量，默认 20，最大 100' },
      query: { type: 'string', description: '搜索素材名称或图片地址' },
      group: { type: 'string', description: '素材分组' },
      source: { type: 'string', description: '来源：generated 或 uploaded' },
      favorite: { type: 'boolean', description: '是否只看收藏素材' },
      draftId: { type: 'number', description: '关联草稿 ID' },
      topicId: { type: 'number', description: '关联选题 ID' },
    },
  },
};

export const createDescriptor: ApiDescriptor = {
  code: 'create_assets_create', name: '新建素材', description: '把一个已有 HTTPS 图片地址登记为图片素材。文件上传可先调用 upload_file。',
  module: 'content', method: 'POST', permissionCode: CONTENT_CREATE,
  inputSchema: {
    type: 'object',
    properties: {
      image_url: { type: 'string', description: 'HTTPS 图片地址' },
      title: { type: 'string', description: '素材名称' },
      group: { type: 'string', description: '素材分组' },
    },
    required: ['image_url'],
  },
};

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
