import type { CacheImpactPlan } from '@/lib/cache-impact';

type CdnClient = {
  PurgeUrlsCache(input: { Urls: string[] }): Promise<TencentCdnPurgeSubmissionResponse>;
  PurgePathCache(input: {
    Paths: string[];
    FlushType: 'delete';
  }): Promise<TencentCdnPurgeSubmissionResponse>;
  DescribePurgeTasks(input: TencentCdnPurgeTasksRequest): Promise<TencentCdnPurgeTasksResponse>;
};

export type TencentCdnPurgeType = 'url' | 'path';
export type TencentCdnPurgeStatus = 'process' | 'done' | 'fail';
export type TencentCdnPurgeArea = 'mainland' | 'overseas' | 'global';

export interface TencentCdnPurgeTasksRequest {
  PurgeType?: TencentCdnPurgeType;
  StartTime?: string;
  EndTime?: string;
  Offset?: number;
  Limit?: number;
  Keyword?: string;
  Status?: TencentCdnPurgeStatus;
  Area?: TencentCdnPurgeArea;
}

export interface TencentCdnPurgeTask {
  TaskId?: string;
  Url?: string;
  Status?: TencentCdnPurgeStatus;
  PurgeType?: TencentCdnPurgeType;
  FlushType?: 'flush' | 'delete';
  CreateTime?: string;
}

export interface TencentCdnPurgeTasksResponse {
  PurgeLogs?: TencentCdnPurgeTask[];
  TotalCount?: number;
  RequestId?: string;
}

export interface TencentCdnPurgeSubmissionResponse {
  TaskId?: string;
  RequestId?: string;
}

export interface TencentCdnPurgeTasksQuery {
  startTime: string;
  endTime: string;
  offset: number;
  limit: number;
  purgeType?: TencentCdnPurgeType;
  keyword?: string;
  status?: TencentCdnPurgeStatus;
  area?: TencentCdnPurgeArea;
}

const recentPurges = new Map<string, number>();
const DEFAULT_SITE_URL = 'https://www.nnnnzs.cn';
const URL_BATCH_SIZE = 1000;
const PATH_BATCH_SIZE = 500;

export function getTencentCdnSiteUrl(): string {
  const configured =
    process.env.CDN_SITE_URL ||
    (process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost')
      ? undefined
      : process.env.NEXT_PUBLIC_SITE_URL);
  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function toAbsoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${getTencentCdnSiteUrl()}${value.startsWith('/') ? value : `/${value}`}`;
}

export function classifyTencentCdnTargets(
  plan: Pick<CacheImpactPlan, 'cdnPagePaths' | 'cdnAssetUrls' | 'cdnFullSite'>,
): { urlTargets: string[]; pathTargets: string[] } {
  const urlTargets = plan.cdnAssetUrls.map(toAbsoluteUrl);
  const pathTargets: string[] = [];
  if (plan.cdnFullSite) return { urlTargets, pathTargets };

  for (const path of plan.cdnPagePaths) {
    if (path === '/' || path.endsWith('.xml')) {
      urlTargets.push(toAbsoluteUrl(path));
    } else {
      const absolute = toAbsoluteUrl(path);
      pathTargets.push(absolute.endsWith('/') ? absolute : `${absolute}/`);
    }
  }
  return {
    urlTargets: [...new Set(urlTargets)],
    pathTargets: [...new Set(pathTargets)],
  };
}

function isRecent(key: string): boolean {
  const now = Date.now();
  const ttl = Number(process.env.CDN_PURGE_DEDUPE_MS || 10_000);
  const previous = recentPurges.get(key);
  if (previous && now - previous < ttl) return true;
  recentPurges.set(key, now);

  for (const [candidate, timestamp] of recentPurges) {
    if (now - timestamp > ttl * 2) recentPurges.delete(candidate);
  }
  return false;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function createClient(): Promise<CdnClient> {
  const secretId = process.env.SecretId || process.env.COS_SECRET_ID;
  const secretKey = process.env.SecretKey || process.env.COS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('腾讯云 CDN 配置缺失：SecretId 或 SecretKey');
  }

  const sdk = await import('tencentcloud-sdk-nodejs');
  return new sdk.cdn.v20180606.Client({
    credential: { secretId, secretKey },
    region: '',
    profile: { httpProfile: { endpoint: 'cdn.tencentcloudapi.com' } },
  }) as CdnClient;
}

export async function purgeTencentCdn(
  plan: Pick<CacheImpactPlan, 'cdnPagePaths' | 'cdnAssetUrls' | 'cdnFullSite'>,
): Promise<void> {
  const purgeFullSite = Boolean(plan.cdnFullSite) && !isRecent('full-site');
  const classified = classifyTencentCdnTargets(plan);
  const urlTargets = classified.urlTargets
    .filter((url) => !isRecent(`url:${url}`));
  const pathTargets = classified.pathTargets
    .filter((path) => !isRecent(`path:${path}`));

  if (!urlTargets.length && !pathTargets.length && !purgeFullSite) return;
  const client = await createClient();

  for (const urls of chunks([...new Set(urlTargets)], URL_BATCH_SIZE)) {
    if (!urls.length) continue;
    const response = await client.PurgeUrlsCache({ Urls: urls });
    console.info('[CDN刷新] URL刷新已提交', {
      count: urls.length,
      requestId: response.RequestId,
    });
  }

  if (purgeFullSite) {
    const response = await client.PurgePathCache({
      Paths: [`${getTencentCdnSiteUrl()}/`],
      FlushType: 'delete',
    });
    console.info('[CDN刷新] 全站目录刷新已提交', { requestId: response.RequestId });
    return;
  }

  for (const paths of chunks([...new Set(pathTargets)], PATH_BATCH_SIZE)) {
    if (!paths.length) continue;
    const response = await client.PurgePathCache({ Paths: paths, FlushType: 'delete' });
    console.info('[CDN刷新] 目录刷新已提交', {
      count: paths.length,
      requestId: response.RequestId,
    });
  }
}

export async function purgeTencentCdnUrl(
  url: string,
  clientOverride?: CdnClient,
): Promise<TencentCdnPurgeSubmissionResponse & { deduplicated?: boolean }> {
  if (isRecent(`manual-url:${url}`)) {
    return { deduplicated: true };
  }

  const client = clientOverride || await createClient();
  const response = await client.PurgeUrlsCache({ Urls: [url] });
  console.info('[CDN刷新] 当前页面 URL 刷新已提交', {
    url,
    taskId: response.TaskId,
    requestId: response.RequestId,
  });
  return response;
}

export async function queryTencentCdnPurgeTasks(
  input: TencentCdnPurgeTasksQuery,
  clientOverride?: CdnClient,
): Promise<TencentCdnPurgeTasksResponse> {
  const client = clientOverride || await createClient();

  return client.DescribePurgeTasks({
    StartTime: input.startTime,
    EndTime: input.endTime,
    Offset: input.offset,
    Limit: input.limit,
    PurgeType: input.purgeType,
    Keyword: input.keyword,
    Status: input.status,
    Area: input.area,
  });
}
