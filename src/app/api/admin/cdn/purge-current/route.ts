/**
 * 提交当前页面 CDN 刷新任务
 * POST /api/admin/cdn/purge-current
 */

import { NextRequest, NextResponse } from 'next/server';
import { CDN_PURGE_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import {
  getTencentCdnSiteUrl,
  purgeTencentCdnUrl,
} from '@/services/tencent-cdn';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const descriptor: ApiDescriptor = {
  code: 'cdn_purge_current',
  name: '刷新当前页面 CDN',
  module: 'cdn',
  method: 'POST',
  permissionCode: CDN_PURGE_VIEW,
  inputSchema: {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', description: '当前页面路径或完整 URL' },
    },
  },
};

export async function POST(request: NextRequest) {
  const check = await requirePermission(request, CDN_PURGE_VIEW);
  if ('error' in check) {
    return NextResponse.json(errorResponse(check.error), { status: check.status });
  }

  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json(errorResponse('缺少当前页面 URL'), { status: 400 });
    }

    const siteUrl = new URL(getTencentCdnSiteUrl());
    const currentUrl = new URL(body.url.trim(), siteUrl);
    if (
      !['http:', 'https:'].includes(currentUrl.protocol) ||
      currentUrl.origin !== siteUrl.origin
    ) {
      return NextResponse.json(errorResponse('当前页面 URL 不属于站点 CDN 域名'), { status: 400 });
    }

    currentUrl.hash = '';
    const result = await purgeTencentCdnUrl(currentUrl.toString());
    return NextResponse.json(
      successResponse(
        {
          url: currentUrl.toString(),
          taskId: result.TaskId,
          deduplicated: result.deduplicated === true,
        },
        result.deduplicated ? '当前页面近期已提交过 CDN 刷新' : '当前页面 CDN 刷新已提交',
      ),
      {
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (error) {
    console.error('刷新当前页面 CDN 失败:', error);
    return NextResponse.json(errorResponse('刷新当前页面 CDN 失败'), { status: 500 });
  }
}
