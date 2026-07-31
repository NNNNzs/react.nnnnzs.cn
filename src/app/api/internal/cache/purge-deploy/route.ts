import { timingSafeEqual } from 'node:crypto';
import { readFile, rename, unlink } from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { collectDeployCacheImpact, type DeployCacheCatalog } from '@/lib/cache-impact';
import { executeDeployCacheImpact } from '@/services/cache-refresh';
import { getPostList } from '@/services/post';
import { getAllTags } from '@/services/tag';
import { getAllCategories } from '@/services/category';
import { getCollectionList } from '@/services/collection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DeployPurgeManifest {
  source: 'deploy';
  changedFiles: string[];
  fullSite?: boolean;
  commit?: string;
  version?: string;
  createdAt?: string;
}

const MANIFEST_PATH =
  process.env.CDN_PURGE_MANIFEST_PATH || '/app/.cdn-purge/pending.json';

function isAuthorized(request: NextRequest): boolean {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return false;
  const expected = process.env.CDN_PURGE_SECRET;
  const actual = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer);
}

async function getDeployCatalog(): Promise<DeployCacheCatalog> {
  const [posts, tags, categories, collections] = await Promise.all([
    getPostList({ pageNum: 1, pageSize: 10_000, hide: '0' }),
    getAllTags(),
    getAllCategories(),
    getCollectionList({ pageNum: 1, pageSize: 1_000, status: 1 }),
  ]);
  return {
    postPaths: posts.record.map((post) => post.path).filter((path): path is string => Boolean(path)),
    tagNames: tags.map(([tag]) => tag),
    categoryNames: categories.map(([category]) => category),
    collectionSlugs: collections.record.map((collection) => collection.slug),
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ status: false, message: '未授权' }, { status: 401 });
  }

  const processingPath = `${MANIFEST_PATH}.processing`;
  try {
    await rename(MANIFEST_PATH, processingPath);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      return NextResponse.json({ status: true, message: '没有待处理的 CDN 刷新清单' });
    }
    console.error('[部署CDN刷新] 获取清单失败:', error);
    return NextResponse.json({ status: true, message: '读取清单失败，已跳过' });
  }

  try {
    const manifest = JSON.parse(await readFile(processingPath, 'utf8')) as DeployPurgeManifest;
    const catalog = await getDeployCatalog();
    const plan = collectDeployCacheImpact(manifest.changedFiles || [], catalog);
    if (manifest.fullSite) {
      plan.cdnFullSite = true;
      if (!plan.cdnPagePaths.includes('/')) plan.cdnPagePaths.push('/');
      if (!plan.warmupTargets.some((target) => target.path === '/')) {
        plan.warmupTargets.push({ path: '/', verifyRenderMarker: true });
      }
    }
    await executeDeployCacheImpact(plan);
    console.info('[部署CDN刷新] 清单消费完成', {
      commit: manifest.commit,
      version: manifest.version,
      changedFiles: manifest.changedFiles?.length || 0,
      fullSite: Boolean(plan.cdnFullSite),
    });
    return NextResponse.json({ status: true, message: '部署 CDN 刷新已执行' });
  } catch (error) {
    console.error('[部署CDN刷新] 执行失败，不影响部署结果:', error);
    return NextResponse.json({ status: true, message: 'CDN 刷新失败，已记录日志' });
  } finally {
    await unlink(processingPath).catch(() => {});
  }
}
