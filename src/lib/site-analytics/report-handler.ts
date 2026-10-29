import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { ANALYTICS_VIEW } from '@/constants/permissions';
import { getAnalyticsReport, parseReportRange } from '@/services/site-analytics/report';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { Ga4ConfigurationError, Ga4ReportError } from '@/services/ga4';

export async function analyticsReportResponse(request: NextRequest, kind: 'overview' | 'pages' | 'sources') {
  const headers = { 'Cache-Control': 'private, no-store' };
  const check = await requirePermission(request, ANALYTICS_VIEW);
  if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status, headers });
  if (check.user.dataScopes[ANALYTICS_VIEW] !== 'all') return NextResponse.json(errorResponse('访问统计需要全站数据权限'), { status: 403, headers });
  let range: { from: string; to: string };
  try { range = parseReportRange(request.nextUrl.searchParams); } catch {
    return NextResponse.json(errorResponse('日期范围无效，最多查询 730 天'), { status: 400, headers });
  }
  try {
    const report = await getAnalyticsReport(range.from, range.to);
    return NextResponse.json(successResponse(kind === 'overview' ? report : { records: report[kind], limit: 50 }), { headers });
  } catch (error) {
    const message = error instanceof Ga4ConfigurationError || error instanceof Ga4ReportError ? error.message : 'GA4 报表暂不可用，请检查服务账号权限、Data API 和服务器网络';
    return NextResponse.json(errorResponse(message), { status: 503, headers });
  }
}
