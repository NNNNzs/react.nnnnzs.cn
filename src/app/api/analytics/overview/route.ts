import { NextRequest } from 'next/server';
import { analyticsReportResponse } from '@/lib/site-analytics/report-handler';
import { ANALYTICS_VIEW } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = { code: 'analytics_overview', name: '访问概览', module: 'analytics', method: 'GET', permissionCode: ANALYTICS_VIEW };
export async function GET(request: NextRequest) { return analyticsReportResponse(request, 'overview'); }
