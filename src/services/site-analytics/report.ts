import { getCachedGa4Report } from '@/services/ga4';
import type { AnalyticsReport } from '@/dto/analytics.dto';
export { parseReportRange } from '@/lib/ga4-report';

/** 总 UV 读取无维度报表，不累加逐日或逐页面 UV。 */
export async function getAnalyticsReport(from: string, to: string): Promise<AnalyticsReport> {
  const { reports, configuredStart, generatedAt } = await getCachedGa4Report(from, to);
  const [total, daily, pages, sources] = reports;
  const totals = total.rows[0]?.metrics || {};
  const warnings: string[] = [];
  if (reports.some(report => report.metadata.subjectToThresholding)) warnings.push('部分数据受 GA4 隐私阈值限制');
  if (reports.some(report => report.metadata.dataLossFromOtherRow)) warnings.push('部分高基数数据归入 GA4 的 (other) 行');
  if (reports.some(report => report.metadata.samplingMetadatas?.length)) warnings.push('部分 GA4 报表包含抽样数据');
  const pv = Number(totals.screenPageViews || 0);
  const dailyMap = new Map(daily.rows.map(row => [row.dimensions.date, row.metrics]));
  const trend: AnalyticsReport['trend'] = [];
  for (let value = Date.parse(from); value <= Date.parse(to); value += 86400_000) {
    const date = new Date(value).toISOString().slice(0, 10);
    const row = dailyMap.get(date.replaceAll('-', '')) || {};
    trend.push({ date, pv: Number(row.screenPageViews || 0), uv: Number(row.totalUsers || 0), sessions: Number(row.sessions || 0) });
  }
  return { source: 'ga4', configuredStart, generatedAt, timeZone: total.metadata.timeZone || 'GA4 媒体资源时区', warnings,
    totals: { pv, uv: Number(totals.totalUsers || 0), sessions: Number(totals.sessions || 0) }, trend,
    pages: pages.rows.map(row => ({ path: row.dimensions.pagePath, pv: Number(row.metrics.screenPageViews || 0), uv: Number(row.metrics.totalUsers || 0), share: pv ? Number(row.metrics.screenPageViews || 0) / pv : 0 })),
    sources: sources.rows.map(row => ({ source: row.dimensions.sessionSource, medium: row.dimensions.sessionMedium, sessions: Number(row.metrics.sessions || 0) })),
  };
}
