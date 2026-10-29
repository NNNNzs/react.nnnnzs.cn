'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicAnalyticsSummary } from '@/dto/analytics.dto';
import { formatPublicAnalyticsCount } from '@/lib/analytics-format';

/** 读取 GA4 汇总数据，不生成额外的浏览事件。 */
export default function FooterVisitorStats() {
  const element = useRef<HTMLElement>(null);
  const [data, setData] = useState<PublicAnalyticsSummary | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let visible = false;
    let inFlight = false;
    let lastFetchedAt = 0;
    const load = async () => {
      if (!visible || inFlight || document.visibilityState !== 'visible' || Date.now() - lastFetchedAt < 10_000) return;
      inFlight = true;
      lastFetchedAt = Date.now();
      try {
        const response = await fetch('/api/analytics/public', { signal: controller.signal });
        if (!response.ok) throw new Error('UNAVAILABLE');
        const result = await response.json();
        if (!result.status || typeof result.data?.visitors !== 'string' || typeof result.data?.pageViews !== 'string'
          || !/^\d+$/.test(result.data.visitors) || !/^\d+$/.test(result.data.pageViews)) throw new Error('INVALID_SUMMARY');
        if (!controller.signal.aborted) { setData(result.data); setUnavailable(false); }
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally { inFlight = false; }
    };
    const refresh = () => { void load(); };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) refresh();
    }, { rootMargin: '120px' }) : null;
    if (observer && element.current) observer.observe(element.current);
    else { visible = true; refresh(); }
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort(); observer?.disconnect();
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const startLabel = data?.startedAt ? `${data.startedAt} 起` : 'GA4 累计';
  return <section ref={element} aria-label="本站访问统计" className="mb-6">
    <dl className="mx-auto flex w-fit flex-wrap justify-center gap-y-4 text-slate-600 dark:text-slate-400">
      <div className="px-6 sm:px-10" title="GA4 在统计区间内去重的总用户数（totalUsers），不等同于实名人数。">
        <dt className="mb-1 text-xs">累计访客 <span className="font-mono text-[10px] opacity-70">UV</span></dt>
        <dd className="font-mono text-xl font-medium tabular-nums tracking-tight text-slate-800 dark:text-slate-100">{formatPublicAnalyticsCount(data?.visitors ?? null)}</dd>
      </div>
      <div className="border-l border-slate-300 px-6 dark:border-slate-700 sm:px-10" title="GA4 记录的本站页面浏览次数（screenPageViews）。">
        <dt className="mb-1 text-xs">累计浏览 <span className="font-mono text-[10px] opacity-70">PV</span></dt>
        <dd className="font-mono text-xl font-medium tabular-nums tracking-tight text-slate-800 dark:text-slate-100">{formatPublicAnalyticsCount(data?.pageViews ?? null)}</dd>
      </div>
    </dl>
    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500" role="status">{data ? `${startLabel} · 数据来源 GA4${unavailable ? ' · 暂时无法刷新' : ''}` : unavailable ? '访问统计暂不可用' : '正在读取访问统计'}</p>
  </section>;
}
