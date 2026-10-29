import { z } from 'zod';
import { analyticsDate } from './analytics-format';

export const GA4_CACHE_SECONDS = 1800;
export const DEFAULT_GA4_START_DATE = '2015-08-14';

export function validReportDate(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
export function parseReportRange(params: URLSearchParams, now = new Date()) {
  const today = analyticsDate(now);
  const from = params.get('from') || new Date(new Date(`${today}T00:00:00Z`).getTime() - 6 * 86400_000).toISOString().slice(0, 10);
  const to = params.get('to') || today;
  if (!validReportDate(from) || !validReportDate(to) || from < DEFAULT_GA4_START_DATE || from > to || to > today
    || Date.parse(to) - Date.parse(from) > 729 * 86400_000) throw new Error('日期范围无效，最多查询 730 天');
  return { from, to };
}

const reportSchema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })).default([]),
  metricHeaders: z.array(z.object({ name: z.string() })).min(1),
  rows: z.array(z.object({
    dimensionValues: z.array(z.object({ value: z.string() })).default([]),
    metricValues: z.array(z.object({ value: z.string() })).default([]),
  })).default([]),
  metadata: z.object({
    timeZone: z.string().optional(), subjectToThresholding: z.boolean().optional(),
    dataLossFromOtherRow: z.boolean().optional(), samplingMetadatas: z.array(z.unknown()).optional(),
    emptyReason: z.string().optional(),
  }).default({}),
});

export function parseGa4Report(value: unknown, expected?: {
  metrics: readonly { name: string }[];
  dimensions?: readonly { name: string }[];
}) {
  const report = reportSchema.parse(value);
  if (expected) {
    const sameHeaders = (actual: { name: string }[], required: readonly { name: string }[]) =>
      actual.length === required.length && new Set(actual.map(header => header.name)).size === actual.length
      && required.every(header => actual.some(item => item.name === header.name));
    if (!sameHeaders(report.metricHeaders, expected.metrics)
      || !sameHeaders(report.dimensionHeaders, expected.dimensions || [])) throw new Error('GA4 报表指标或维度与请求不一致');
  }
  if (!report.rows.length && report.metadata.subjectToThresholding) throw new Error('GA4 数据受限，暂无法展示统计');
  const rows = report.rows.map(row => {
    if (row.metricValues.length !== report.metricHeaders.length || row.dimensionValues.length !== report.dimensionHeaders.length) throw new Error('GA4 报表字段不完整');
    const dimensions = Object.fromEntries(report.dimensionHeaders.map((header, index) => [header.name, row.dimensionValues[index].value]));
    const metrics = Object.fromEntries(report.metricHeaders.map((header, index) => {
      const value = row.metricValues[index].value;
      if (!/^\d+$/.test(value)) throw new Error('GA4 计数格式无效');
      return [header.name, value];
    }));
    return { dimensions, metrics };
  });
  return { rows, metadata: report.metadata };
}

export function buildGa4Reports(from: string, to: string, hostname: string) {
  const base = {
    dateRanges: [{ startDate: from, endDate: to }],
    dimensionFilter: { andGroup: { expressions: [
      { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: hostname } } },
      { filter: { fieldName: 'platform', stringFilter: { matchType: 'EXACT', value: 'web', caseSensitive: false } } },
    ] } },
  };
  return [
    { ...base, metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'sessions' }] },
    { ...base, dimensions: [{ name: 'date' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 730 },
    { ...base, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 50 },
    { ...base, dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 50 },
  ] as const;
}
