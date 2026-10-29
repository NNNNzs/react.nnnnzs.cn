import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGa4Reports, parseGa4Report, parseReportRange } from './ga4-report';
import { analyticsDate, formatPublicAnalyticsCount } from './analytics-format';

test('累计 UV 请求没有日期分组，避免误加每日 UV', () => {
  const [totals, daily, pages, sources] = buildGa4Reports('2026-01-01', 'today', 'www.nnnnzs.cn');
  assert.equal('dimensions' in totals, false);
  assert.deepEqual(totals.metrics.map(item => item.name), ['screenPageViews', 'totalUsers', 'sessions']);
  assert.deepEqual(daily.dimensions, [{ name: 'date' }]);
  assert.deepEqual(pages.dimensions, [{ name: 'pagePath' }]);
  assert.deepEqual(sources.metrics, [{ name: 'sessions' }]);
  assert.equal(totals.dimensionFilter.andGroup.expressions[0].filter.stringFilter.value, 'www.nnnnzs.cn');
  assert.equal(pages.limit, 50);
});

test('按 API 返回的字段名称映射，不依赖指标顺序', () => {
  const report = parseGa4Report({ metricHeaders: [{ name: 'totalUsers' }, { name: 'screenPageViews' }], rows: [{ metricValues: [{ value: '123' }, { value: '9007199254740993' }] }], metadata: { timeZone: 'Asia/Shanghai' } });
  assert.deepEqual(report.rows[0].metrics, { totalUsers: '123', screenPageViews: '9007199254740993' });
  assert.equal(report.metadata.timeZone, 'Asia/Shanghai');
});

test('隐私抑制与错误数据不冒充零访问', () => {
  assert.throws(() => parseGa4Report({ metadata: { subjectToThresholding: true } }));
  assert.throws(() => parseGa4Report({ metricHeaders: [{ name: 'totalUsers' }], rows: [{ metricValues: [] }] }));
  for (const value of ['NaN', '-1', '1.5', '']) assert.throws(() => parseGa4Report({ metricHeaders: [{ name: 'totalUsers' }], rows: [{ metricValues: [{ value }] }] }));
  assert.throws(() => parseGa4Report({}));
  assert.deepEqual(parseGa4Report({ metricHeaders: [{ name: 'totalUsers' }] }).rows, []);
});

test('页面维度和抽样、阈值等元信息被保留', () => {
  const report = parseGa4Report({ dimensionHeaders: [{ name: 'pagePath' }], metricHeaders: [{ name: 'screenPageViews' }], rows: [{ dimensionValues: [{ value: '/chat' }], metricValues: [{ value: '8' }] }], metadata: { dataLossFromOtherRow: true, samplingMetadatas: [{}] } });
  assert.equal(report.rows[0].dimensions.pagePath, '/chat');
  assert.equal(report.metadata.dataLossFromOtherRow, true);
  assert.equal(report.metadata.samplingMetadatas?.length, 1);
});

test('缺失请求指标或维度时拒绝报表，避免展示成零访问', () => {
  const [totals, daily] = buildGa4Reports('2026-10-01', '2026-10-28', 'www.nnnnzs.cn');
  assert.throws(() => parseGa4Report({ metricHeaders: [{ name: 'totalUsers' }] }, totals));
  const metricHeaders = totals.metrics.map(({ name }) => ({ name }));
  assert.deepEqual(parseGa4Report({ metricHeaders: [...metricHeaders].reverse() }, totals).rows, []);
  assert.throws(() => parseGa4Report({ metricHeaders }, daily));
  assert.throws(() => parseGa4Report({ metricHeaders: [metricHeaders[0], metricHeaders[0], metricHeaders[2]] }, totals));
});

test('查询日期拒绝未来、错误和超长区间', () => {
  const now = new Date('2026-10-28T04:00:00Z');
  assert.deepEqual(parseReportRange(new URLSearchParams(), now), { from: '2026-10-22', to: '2026-10-28' });
  for (const query of ['from=2026-02-30', 'from=2026-10-29', 'from=2026-10-28&to=2026-10-27', 'from=2020-01-01']) assert.throws(() => parseReportRange(new URLSearchParams(query), now));
  assert.equal(analyticsDate(new Date('2026-10-28T16:00:00Z')), '2026-10-29');
});

test('页脚数字保留精度，未知数据使用占位', () => {
  assert.equal(formatPublicAnalyticsCount('9007199254740993123456'), '9,007,199,254,740,993,123,456');
  assert.equal(formatPublicAnalyticsCount('0'), '0');
  assert.equal(formatPublicAnalyticsCount(null), '—');
  assert.equal(formatPublicAnalyticsCount('NaN'), '—');
});
