/** GA4 报表只返回汇总数据；公开计数使用十进制字符串避免精度丢失。 */
export interface PublicAnalyticsSummary {
  visitors: string;
  pageViews: string;
  startedAt: string | null;
  updatedAt: string;
  source: 'ga4';
}
export interface AnalyticsCount { pv: number; uv: number; sessions: number }
export interface AnalyticsReport {
  source: 'ga4';
  configuredStart: string | null;
  generatedAt: string;
  timeZone: string;
  warnings: string[];
  totals: AnalyticsCount;
  trend: Array<AnalyticsCount & { date: string }>;
  pages: Array<{ path: string; pv: number; uv: number; share: number }>;
  sources: Array<{ source: string; medium: string; sessions: number }>;
}
