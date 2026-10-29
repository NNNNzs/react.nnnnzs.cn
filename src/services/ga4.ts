import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { JWT } from 'google-auth-library';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { configByKeys } from '@/services/config';
import { proxyFetch } from '@/lib/proxy-fetch';
import { analyticsDate } from '@/lib/analytics-format';
import { DEFAULT_GA4_START_DATE, GA4_CACHE_SECONDS, buildGa4Reports, parseGa4Report, validReportDate } from '@/lib/ga4-report';

export class Ga4ConfigurationError extends Error {}
/** 仅包含可展示的诊断信息，不保留上游响应、凭据或请求头。 */
export class Ga4ReportError extends Error {}

const credentialsSchema = z.object({ type: z.literal('service_account'), client_email: z.email(), private_key: z.string().min(1) });
let auth: { fingerprint: string; client: JWT } | undefined;

export async function getGa4ReportConfig() {
  const values = await configByKeys(['ga4.property_id', 'ga4.stats_start_date']);
  const readValue = (key: string) => values[key]?.status === 1 ? values[key].value?.trim() || '' : '';
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() || readValue('ga4.property_id');
  const configuredStart = process.env.GA4_STATS_START_DATE?.trim() || readValue('ga4.stats_start_date');
  const hostname = process.env.GA4_REPORT_HOSTNAME?.trim() || 'www.nnnnzs.cn';
  if (!/^[a-z0-9.-]+$/i.test(hostname)) throw new Ga4ConfigurationError('GA4_REPORT_HOSTNAME 只能填写站点主机名，不包含协议或路径');
  if (!/^\d+$/.test(propertyId)) throw new Ga4ConfigurationError('请配置 GA4 数字 Property ID（ga4.property_id 或 GA4_PROPERTY_ID），测量 ID 不能替代');
  if (configuredStart && (!validReportDate(configuredStart) || configuredStart < DEFAULT_GA4_START_DATE
    || configuredStart > analyticsDate(new Date()))) throw new Ga4ConfigurationError('GA4 统计起始日期无效，请使用不晚于今天的 YYYY-MM-DD');
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!credentialPath && !credentialJson) throw new Ga4ConfigurationError('请配置服务账号凭据 GOOGLE_APPLICATION_CREDENTIALS 或 GA4_SERVICE_ACCOUNT_JSON，并授予 GA4 查看者权限');
  let text: string;
  try { text = credentialJson || await readFile(credentialPath!, 'utf8'); }
  catch { throw new Ga4ConfigurationError('无法读取 GA4 服务账号凭据文件'); }
  let credentials: z.infer<typeof credentialsSchema>;
  try { credentials = credentialsSchema.parse(JSON.parse(text)); }
  catch { throw new Ga4ConfigurationError('GA4 凭据需为有效的服务账号 JSON'); }
  const fingerprint = createHash('sha256').update(text).digest('hex');
  if (!auth || auth.fingerprint !== fingerprint) auth = {
    fingerprint,
    client: new JWT({ email: credentials.client_email, key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      transporterOptions: {
        timeout: 15_000,
        retry: false,
        proxy: process.env.GITHUB_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
      },
    }),
  };
  return { propertyId, configuredStart: configuredStart || null, startDate: configuredStart || DEFAULT_GA4_START_DATE,
    fingerprint, hostname, client: auth.client };
}

type Ga4ReportConfig = Awaited<ReturnType<typeof getGa4ReportConfig>>;

async function requestGa4(config: Ga4ReportConfig, method: 'runReport' | 'batchRunReports', body: unknown) {
  let token: string | null | undefined;
  try { token = (await config.client.getAccessToken()).token; }
  catch { throw new Ga4ReportError('Google 服务账号认证失败，请检查凭据、代理和网络'); }
  if (!token) throw new Ga4ReportError('未取得 Google 只读访问令牌');
  let response: Response;
  try {
    response = await proxyFetch(`https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:${method}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new Ga4ReportError('无法连接 GA4 Data API，请检查服务器网络与代理'); }
  if (!response.ok) {
    if (response.status === 403) throw new Ga4ReportError('GA4 报表访问被拒绝：请启用 Analytics Data API，并为服务账号授予该媒体资源的查看者权限');
    if (response.status === 429) throw new Ga4ReportError('GA4 报表配额暂时不足，请稍后重试');
    throw new Ga4ReportError(`GA4 报表读取失败（HTTP ${response.status}）`);
  }
  try { return await response.json() as unknown; }
  catch { throw new Ga4ReportError('GA4 报表返回格式无效'); }
}

async function readGa4Report(config: Ga4ReportConfig, from: string, to: string) {
  const requests = buildGa4Reports(from, to, config.hostname);
  const payload = z.object({ reports: z.array(z.unknown()).length(4) })
    .parse(await requestGa4(config, 'batchRunReports', { requests }));
  const reports = payload.reports.map((report, index) => parseGa4Report(report, requests[index]));
  return { reports, configuredStart: config.configuredStart, generatedAt: new Date().toISOString() };
}

async function readGa4Summary(config: Ga4ReportConfig) {
  const request = buildGa4Reports(config.startDate, 'today', config.hostname)[0];
  const report = parseGa4Report(await requestGa4(config, 'runReport', request), request);
  if (report.metadata.subjectToThresholding) throw new Ga4ReportError('GA4 累计统计受隐私阈值限制，暂无法准确展示');
  return { report, configuredStart: config.configuredStart, generatedAt: new Date().toISOString() };
}

export async function fetchGa4Report(from: string, to: string) {
  return readGa4Report(await getGa4ReportConfig(), from, to);
}

export async function fetchGa4Summary() {
  return readGa4Summary(await getGa4ReportConfig());
}

export async function getCachedGa4Summary() {
  const config = await getGa4ReportConfig();
  return unstable_cache(() => readGa4Summary(config),
    ['ga4-public-v1', config.propertyId, config.hostname, config.fingerprint, config.startDate],
    { revalidate: GA4_CACHE_SECONDS })();
}

export async function getCachedGa4Report(from: string, to: string) {
  const config = await getGa4ReportConfig();
  // 凭据本身不进入缓存键或结果；配置变化后使用新的缓存空间。
  return unstable_cache(() => readGa4Report(config, from, to),
    ['ga4-report-v1', config.propertyId, config.hostname, config.fingerprint, config.startDate, from, to],
    { revalidate: GA4_CACHE_SECONDS })();
}
