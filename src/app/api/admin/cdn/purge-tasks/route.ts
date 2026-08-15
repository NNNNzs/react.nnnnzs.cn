/**
 * CDN 刷新历史查询 API
 * GET /api/admin/cdn/purge-tasks
 */

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { CDN_PURGE_VIEW } from '@/constants/permissions';
import {
  queryTencentCdnPurgeTasks,
  type TencentCdnPurgeArea,
  type TencentCdnPurgeStatus,
  type TencentCdnPurgeType,
} from '@/services/tencent-cdn';
import type { ApiDescriptor } from '@/types/api-descriptor';

dayjs.extend(utc);
dayjs.extend(timezone);

const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const descriptor: ApiDescriptor = {
  code: 'cdn_purge_tasks_list',
  name: 'CDN 刷新记录',
  module: 'cdn',
  method: 'GET',
  permissionCode: CDN_PURGE_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码，从 1 开始' },
      pageSize: { type: 'number', description: '每页数量，最大 100' },
      startTime: { type: 'string', description: '开始时间，东八区 YYYY-MM-DD HH:mm:ss' },
      endTime: { type: 'string', description: '结束时间，东八区 YYYY-MM-DD HH:mm:ss' },
      keyword: { type: 'string', description: '域名或完整 URL' },
      purgeType: { type: 'string', description: '刷新类型：url 或 path' },
      status: { type: 'string', description: '刷新状态：process、done 或 fail' },
      area: { type: 'string', description: '刷新地域：mainland、overseas 或 global' },
    },
  },
};

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultTimeRange(): { startTime: string; endTime: string } {
  const end = dayjs().tz(SHANGHAI_TIMEZONE);
  return {
    startTime: end.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
    endTime: end.format('YYYY-MM-DD HH:mm:ss'),
  };
}

function optionalEnum<T extends string>(value: string | null, values: readonly T[]): T | undefined {
  return value && values.includes(value as T) ? value as T : undefined;
}

export async function GET(request: NextRequest) {
  const check = await requirePermission(request, CDN_PURGE_VIEW);
  if ('error' in check) {
    return NextResponse.json(errorResponse(check.error), { status: check.status });
  }

  try {
    const params = request.nextUrl.searchParams;
    const pageNum = parsePositiveInteger(params.get('pageNum'), 1);
    const pageSize = Math.min(
      parsePositiveInteger(params.get('pageSize'), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const defaults = defaultTimeRange();
    const purgeType = optionalEnum(params.get('purgeType'), ['url', 'path'] as const);
    const status = optionalEnum(params.get('status'), ['process', 'done', 'fail'] as const);
    const area = optionalEnum(params.get('area'), ['mainland', 'overseas', 'global'] as const);
    const keyword = params.get('keyword')?.trim().slice(0, 500) || undefined;
    const startTime = params.get('startTime')?.trim() || defaults.startTime;
    const endTime = params.get('endTime')?.trim() || defaults.endTime;

    const result = await queryTencentCdnPurgeTasks({
      startTime,
      endTime,
      offset: (pageNum - 1) * pageSize,
      limit: pageSize,
      keyword,
      purgeType: purgeType as TencentCdnPurgeType | undefined,
      status: status as TencentCdnPurgeStatus | undefined,
      area: area as TencentCdnPurgeArea | undefined,
    });

    return NextResponse.json(
      successResponse({
        record: result.PurgeLogs || [],
        total: result.TotalCount || 0,
        pageNum,
        pageSize,
      }),
      {
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (error) {
    console.error('查询 CDN 刷新记录失败:', error);
    return NextResponse.json(errorResponse('查询 CDN 刷新记录失败'), { status: 500 });
  }
}
