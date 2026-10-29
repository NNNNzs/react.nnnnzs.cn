'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, DatePicker, Spin, Statistic, Table, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { ReloadOutlined } from '@ant-design/icons';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { ANALYTICS_VIEW } from '@/constants/permissions';
import type { AnalyticsReport } from '@/dto/analytics.dto';
import { analyticsDate } from '@/lib/analytics-format';

function Trend({ rows }: { rows: AnalyticsReport['trend'] }) {
  const max = Math.max(1, ...rows.map(row => Math.max(row.pv, row.uv || 0)));
  const width = Math.max(600, rows.length * 30);
  const point = (value: number, index: number) => `${40 + index * (width - 80) / Math.max(1, rows.length - 1)},${180 - value / max * 145}`;
  return <div className="overflow-x-auto rounded-lg border border-slate-200 p-3">
    <div className="mb-2 flex gap-5 text-xs"><span className="text-blue-600">● PV</span><span className="text-emerald-600">● 每日 UV</span></div>
    <svg viewBox={`0 0 ${width} 215`} style={{ minWidth: width }} className="w-full" role="img" aria-label="每日 PV 与 UV 趋势">
      <line x1="40" y1="180" x2={width - 30} y2="180" stroke="#cbd5e1" />
      <polyline points={rows.map((row, i) => point(row.pv, i)).join(' ')} fill="none" stroke="#2563eb" strokeWidth="2" />
      <polyline points={rows.map((row, i) => point(row.uv || 0, i)).join(' ')} fill="none" stroke="#059669" strokeWidth="2" />
      {rows.map((row, i) => <g key={row.date}><circle cx={point(row.pv, i).split(',')[0]} cy={point(row.pv, i).split(',')[1]} r="3" fill="#2563eb"><title>{`${row.date} PV ${row.pv} / UV ${row.uv} / 会话 ${row.sessions}`}</title></circle>
        {i % Math.max(1, Math.ceil(rows.length / 12)) === 0 ? <text x={point(0, i).split(',')[0]} y="202" textAnchor="middle" fontSize="11" fill="#64748b">{row.date.slice(5)}</text> : null}</g>)}
      <text x="0" y="35" fontSize="11" fill="#64748b">{max}</text>
    </svg>
  </div>;
}

export default function AnalyticsPage() {
  const { loading: authLoading, dataScopes } = useAuth();
  const allowed = dataScopes[ANALYTICS_VIEW] === 'all';
  const today = analyticsDate(new Date());
  const [range, setRange] = useState<[string, string]>([dayjs(today).subtract(6, 'day').format('YYYY-MM-DD'), today]);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; report: AnalyticsReport | null; error: string }>({ key: '', report: null, error: '' });
  const [from, to] = range;
  const requestKey = `${from}:${to}:${revision}`;
  const loading = allowed && result.key !== requestKey;
  const report = result.key === requestKey ? result.report : null;
  const error = result.key === requestKey ? result.error : '';
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    fetch(`/api/analytics/overview?from=${from}&to=${to}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok || !result.status) throw new Error(result.message || '加载失败'); return result.data as AnalyticsReport; })
      .then(data => { if (!controller.signal.aborted) setResult({ key: requestKey, report: data, error: '' }); })
      .catch(reason => { if (!controller.signal.aborted) setResult({ key: requestKey, report: null, error: reason instanceof Error ? reason.message : '加载失败' }); });
    return () => controller.abort();
  }, [allowed, from, to, requestKey]);
  if (!authLoading && !allowed) return <Alert type="warning" title="访问统计需要 analytics:view 的全站数据权限" />;
  return <div className="flex h-full min-h-0 flex-col">
    <AdminPageHeader title="访问统计" description="数据来自 GA4。UV 按所选区间整体去重，报表存在处理延迟，服务器缓存 30 分钟。" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => setRevision(n => n + 1)}>刷新</Button>} />
    <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
      <DatePicker.RangePicker value={[dayjs(from), dayjs(to)]} allowClear={false} disabledDate={date => date.format('YYYY-MM-DD') > today} onChange={values => { if (values?.[0] && values[1]) setRange([values[0].format('YYYY-MM-DD'), values[1].format('YYYY-MM-DD')]); }} />
      {[['今天', 0], ['近七天', 6], ['近三十天', 29]] .map(([label, days]) => <Button key={label} onClick={() => setRange([dayjs(today).subtract(Number(days), 'day').format('YYYY-MM-DD'), today])}>{label}</Button>)}
    </div>
    <div className="min-h-0 flex-1 overflow-auto pb-6">
      {error ? <Alert className="mb-4" type="error" showIcon title={error} /> : null}
      {loading && !report ? <div className="p-12 text-center"><Spin /></div> : null}
      {report ? <Spin spinning={loading}>
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500"><Tag color="blue">GA4</Tag><span>时区：{report.timeZone}</span><span>更新于 {dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm:ss')}</span></div>
        {report.warnings.map(warning => <Alert key={warning} className="mb-4" type="warning" title={warning} />)}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">{[
          ['页面访问 PV', report.totals.pv], ['区间访客 UV', report.totals.uv], ['访问会话', report.totals.sessions],
        ].map(([title, value]) => <div key={title} className="rounded-lg border border-slate-200 bg-white p-4"><Statistic title={title} value={value} /></div>)}</div>
        <Trend rows={report.trend} />
        <Tabs className="mt-4" items={[
          { key: 'days', label: '每日数据', children: <Table size="small" rowKey="date" dataSource={report.trend} pagination={{ pageSize: 15 }} columns={[{ title: '日期', dataIndex: 'date' }, { title: 'PV', dataIndex: 'pv' }, { title: '每日 UV', dataIndex: 'uv' }, { title: '开始的会话', dataIndex: 'sessions' }]} /> },
          { key: 'pages', label: '页面排行 · 前 50', children: <Table size="small" scroll={{ x: 680 }} rowKey="path" dataSource={report.pages} pagination={{ pageSize: 15 }} columns={[{ title: '页面路径', dataIndex: 'path', ellipsis: true }, { title: 'PV', dataIndex: 'pv', width: 90 }, { title: '页面 UV', dataIndex: 'uv', width: 100 }, { title: 'PV 占比', dataIndex: 'share', width: 100, render: (share: number) => `${(share * 100).toFixed(1)}%` }]} /> },
          { key: 'sources', label: '会话来源 · 前 50', children: <Table size="small" scroll={{ x: 680 }} rowKey={row => `${row.source}:${row.medium}`} dataSource={report.sources} pagination={{ pageSize: 15 }} columns={[{ title: '来源', dataIndex: 'source' }, { title: '媒介', dataIndex: 'medium' }, { title: '会话', dataIndex: 'sessions', width: 90 }]} /> },
        ]} />
        <p className="text-xs text-slate-500">日期按 GA4 媒体资源时区划分；UV 使用 totalUsers，不能把每日 UV 相加。数据仅覆盖 GA4 成功采集的访问，受报告处理、隐私阈值和抽样影响。</p>
      </Spin> : null}
    </div>
  </div>;
}
