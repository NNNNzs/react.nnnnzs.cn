import { NextResponse } from 'next/server';
import { getPublicAnalyticsSummary } from '@/services/site-analytics/public-summary';
import { successResponse, errorResponse } from '@/dto/response.dto';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = { code: 'analytics_public', name: '公开全站累计统计', module: 'analytics', method: 'GET' };

export async function GET() {
  try {
    return NextResponse.json(successResponse(await getPublicAnalyticsSummary()), {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json(errorResponse('访问统计暂不可用'), { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
