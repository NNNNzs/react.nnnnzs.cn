/** 浏览器和服务端共用，不依赖 SDK 或报表解析库。 */
export function analyticsDate(now: Date): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
export function formatPublicAnalyticsCount(value: string | null): string {
  return value !== null && /^\d+$/.test(value) ? new Intl.NumberFormat('zh-CN').format(BigInt(value)) : '—';
}
