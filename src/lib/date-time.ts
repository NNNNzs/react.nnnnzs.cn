const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

/**
 * 将时间统一格式化为东八区诊断时间：YYYY-MM-DD HH:mm:ss。
 * 仅用于页面诊断和运维展示；业务 API、JSON-LD 等机器字段继续使用 ISO 格式。
 */
export function formatShanghaiDateTime(
  value: Date | string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-');
}
