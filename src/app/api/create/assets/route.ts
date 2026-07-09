import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_VIEW, CONTENT_CREATE } from '@/constants/permissions';
import { listContentAssets, type ContentAssetSource } from '@/services/content-creation';
import {
  getNumberParam,
  getStringParam,
} from '../_utils';

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

    return NextResponse.json(
      errorResponse('素材库只支持生成图片或上传图片'),
      { status: 400 },
    );
  } catch (error) {
    console.error('创建内容素材失败:', error);
    return NextResponse.json(errorResponse('创建内容素材失败'), { status: 500 });
  }
}
