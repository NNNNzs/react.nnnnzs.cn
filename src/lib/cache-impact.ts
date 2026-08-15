import type { SerializedPost } from '@/dto/post.dto';
import type { PostCollectionInfo } from '@/dto/collection.dto';

export type CacheImpactSource = 'post' | 'collection' | 'deploy';

export interface WarmupTarget {
  path: string;
  expectedPostId?: number;
  expectedUpdatedAt?: string;
  expectedVisibility?: 'visible' | 'absent';
  verifyRenderMarker?: boolean;
}

export interface CacheImpactPlan {
  source: CacheImpactSource;
  nextTags: string[];
  nextPaths: string[];
  warmupTargets: WarmupTarget[];
  cdnPagePaths: string[];
  cdnAssetUrls: string[];
  cdnFullSite?: boolean;
}

export type PostMutationKind = 'create' | 'update' | 'delete' | 'rollback';

export interface PostCacheImpactContext {
  kind: PostMutationKind;
  before?: SerializedPost | null;
  after?: SerializedPost | null;
  beforeCollections?: Array<Pick<PostCollectionInfo, 'slug'>>;
  afterCollections?: Array<Pick<PostCollectionInfo, 'slug'>>;
  changedFields?: Iterable<string>;
}

export interface CollectionCacheImpactContext {
  collectionSlug: string;
  posts: Array<Pick<SerializedPost, 'id' | 'path' | 'updated' | 'hide' | 'is_delete'>>;
  membershipChanged?: boolean;
}

export interface CollectionEntityCacheImpactContext {
  before?: {
    slug: string;
    status: number;
    is_delete: number;
  } | null;
  after?: {
    slug: string;
    status: number;
    is_delete: number;
  } | null;
  posts: Array<Pick<SerializedPost, 'id' | 'path' | 'updated' | 'hide' | 'is_delete'>>;
}

export interface DeployCacheCatalog {
  postPaths: string[];
  tagNames: string[];
  categoryNames: string[];
  collectionSlugs: string[];
}

export const PUBLIC_PAGE_PATHS = {
  home: '/',
  archives: '/archives',
  tagsIndex: '/tags',
  categoriesIndex: '/categories',
  collectionsIndex: '/collections',
  rss: '/rss.xml',
  sitemap: '/sitemap.xml',
} as const;

const DETAIL_FIELDS = new Set(['content', 'description', 'cover', 'layout']);
const IDENTITY_FIELDS = new Set(['title', 'date', 'path']);
const VISIBILITY_FIELDS = new Set(['hide', 'is_delete']);
const SEO_FIELDS = new Set(['seo_indexable']);
const TAXONOMY_FIELDS = new Set(['tags', 'category']);
const COUNTER_FIELDS = new Set(['likes', 'visitors']);
const INTERNAL_FIELDS = new Set([
  'rag_status',
  'rag_error',
  'rag_updated_at',
  'updated',
  'created_by',
]);

export function normalizePublicPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  const path = withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export const publicRoute = {
  post: (path: string) => normalizePublicPath(path),
  tag: (name: string) => `/tags/${encodeURIComponent(name.trim())}`,
  category: (name: string) => `/categories/${encodeURIComponent(name.trim())}`,
  collection: (slug: string) => `/collections/${encodeURIComponent(slug.trim())}`,
};

function unique(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))];
}

function normalizeTags(post?: SerializedPost | null): string[] {
  if (!post?.tags) return [];
  return unique(
    (Array.isArray(post.tags) ? post.tags : String(post.tags).split(','))
      .map((tag) => String(tag).trim())
      .filter(Boolean),
  );
}

function normalizeCollections(
  collections?: Array<Pick<PostCollectionInfo, 'slug'>>,
): string[] {
  return unique((collections || []).map((collection) => collection.slug?.trim()).filter(Boolean));
}

function isPublicPost(post?: SerializedPost | null): boolean {
  return Boolean(post && post.hide === '0' && post.is_delete === 0);
}

function detectChangedFields(
  before?: SerializedPost | null,
  after?: SerializedPost | null,
): Set<string> {
  if (!before || !after) return new Set();
  const fields = new Set<string>();
  for (const key of [
    ...DETAIL_FIELDS,
    ...IDENTITY_FIELDS,
    ...VISIBILITY_FIELDS,
    ...SEO_FIELDS,
    ...TAXONOMY_FIELDS,
    ...COUNTER_FIELDS,
    ...INTERNAL_FIELDS,
  ]) {
    if (JSON.stringify(before[key as keyof SerializedPost]) !== JSON.stringify(after[key as keyof SerializedPost])) {
      fields.add(key);
    }
  }
  return fields;
}

function intersects(fields: Set<string>, candidates: Set<string>): boolean {
  for (const field of fields) {
    if (candidates.has(field)) return true;
  }
  return false;
}

function makeWarmupTarget(
  path: string,
  post?: SerializedPost | null,
  expectedVisibility: 'visible' | 'absent' = 'visible',
  allowCurrentVisibleAlias = false,
): WarmupTarget {
  return {
    path: normalizePublicPath(path),
    expectedPostId: post?.id,
    expectedUpdatedAt:
      expectedVisibility === 'visible' || allowCurrentVisibleAlias
        ? post?.updated || undefined
        : undefined,
    expectedVisibility,
    verifyRenderMarker: !path.endsWith('.xml'),
  };
}

export function normalizeCacheImpactPlan(plan: CacheImpactPlan): CacheImpactPlan {
  const warmupByPath = new Map<string, WarmupTarget>();
  for (const target of plan.warmupTargets) {
    const path = normalizePublicPath(target.path);
    warmupByPath.set(path, { ...target, path });
  }

  return {
    ...plan,
    nextTags: unique(plan.nextTags),
    nextPaths: unique(plan.nextPaths.map(normalizePublicPath)),
    warmupTargets: [...warmupByPath.values()],
    cdnPagePaths: unique(plan.cdnPagePaths.map(normalizePublicPath)),
    cdnAssetUrls: unique(plan.cdnAssetUrls),
  };
}

export function collectPostCacheImpact(context: PostCacheImpactContext): CacheImpactPlan {
  const beforePublic = isPublicPost(context.before);
  const afterPublic = isPublicPost(context.after);
  const fields = new Set(context.changedFields || detectChangedFields(context.before, context.after));
  const onlyIgnoredFields =
    fields.size > 0 &&
    [...fields].every((field) => COUNTER_FIELDS.has(field) || INTERNAL_FIELDS.has(field));

  if (context.kind === 'update' && onlyIgnoredFields) {
    return normalizeCacheImpactPlan({
      source: 'post',
      nextTags: [],
      nextPaths: [],
      warmupTargets: [],
      cdnPagePaths: [],
      cdnAssetUrls: [],
    });
  }

  if (!beforePublic && !afterPublic) {
    return normalizeCacheImpactPlan({
      source: 'post',
      nextTags: [],
      nextPaths: [],
      warmupTargets: [],
      cdnPagePaths: [],
      cdnAssetUrls: [],
    });
  }

  const nonSeoDetailChanged =
    context.kind !== 'update' ||
    intersects(fields, DETAIL_FIELDS) ||
    intersects(fields, IDENTITY_FIELDS) ||
    intersects(fields, VISIBILITY_FIELDS) ||
    intersects(fields, TAXONOMY_FIELDS);
  const seoChanged = intersects(fields, SEO_FIELDS);
  const detailChanged = nonSeoDetailChanged || seoChanged;
  const identityChanged = context.kind !== 'update' || intersects(fields, IDENTITY_FIELDS);
  const visibilityChanged = context.kind !== 'update' || intersects(fields, VISIBILITY_FIELDS);
  const taxonomyChanged = context.kind !== 'update' || intersects(fields, TAXONOMY_FIELDS);

  const beforeTags = normalizeTags(context.before);
  const afterTags = normalizeTags(context.after);
  const beforeCategory = context.before?.category?.trim();
  const afterCategory = context.after?.category?.trim();
  const beforeCollections = normalizeCollections(context.beforeCollections);
  const afterCollections = normalizeCollections(context.afterCollections);
  const collectionChanged =
    JSON.stringify([...beforeCollections].sort()) !== JSON.stringify([...afterCollections].sort());

  const nextTags = new Set<string>();
  const paths = new Set<string>();
  const warmups: WarmupTarget[] = [];

  const addPage = (path: string, target?: WarmupTarget) => {
    const normalized = normalizePublicPath(path);
    paths.add(normalized);
    warmups.push(target || makeWarmupTarget(normalized));
  };

  nextTags.add('post');
  if (context.before?.id) nextTags.add(`post:${context.before.id}`);
  if (context.after?.id) nextTags.add(`post:${context.after.id}`);

  if (detailChanged || collectionChanged) {
    if (context.before?.path && (identityChanged || !afterPublic)) {
      const oldPathRemainsPublic =
        afterPublic && context.after?.path === context.before.path;
      addPage(
        publicRoute.post(context.before.path),
        makeWarmupTarget(
          context.before.path,
          afterPublic ? context.after : context.before,
          oldPathRemainsPublic ? 'visible' : 'absent',
          Boolean(afterPublic && context.after?.path !== context.before.path),
        ),
      );
    }
    if (context.after?.path && afterPublic) {
      addPage(
        publicRoute.post(context.after.path),
        makeWarmupTarget(context.after.path, context.after, 'visible'),
      );
    }
  }

  if (identityChanged || visibilityChanged || context.kind === 'create' || context.kind === 'delete') {
    for (const tag of ['home', 'post-list', 'archives']) nextTags.add(tag);
    addPage(PUBLIC_PAGE_PATHS.home);
    addPage(PUBLIC_PAGE_PATHS.archives);
    addPage(PUBLIC_PAGE_PATHS.sitemap, makeWarmupTarget(PUBLIC_PAGE_PATHS.sitemap));
  }

  if (seoChanged) {
    addPage(PUBLIC_PAGE_PATHS.sitemap, makeWarmupTarget(PUBLIC_PAGE_PATHS.sitemap));
  }

  if (nonSeoDetailChanged) {
    addPage(PUBLIC_PAGE_PATHS.rss, makeWarmupTarget(PUBLIC_PAGE_PATHS.rss));
  }

  if (taxonomyChanged || visibilityChanged || context.kind === 'create' || context.kind === 'delete') {
    for (const tag of ['tags', 'tag-list']) nextTags.add(tag);
    addPage(PUBLIC_PAGE_PATHS.tagsIndex);
    addPage(PUBLIC_PAGE_PATHS.categoriesIndex);
    for (const tag of unique([...beforeTags, ...afterTags])) addPage(publicRoute.tag(tag));
    for (const category of unique([beforeCategory || '', afterCategory || ''])) {
      addPage(publicRoute.category(category));
    }
  }


  if (seoChanged) {
    for (const tag of unique([...beforeTags, ...afterTags])) addPage(publicRoute.tag(tag));
    for (const category of unique([beforeCategory || '', afterCategory || ''])) {
      addPage(publicRoute.category(category));
    }
  }

  if (detailChanged || identityChanged || visibilityChanged || collectionChanged || seoChanged) {
    if (nonSeoDetailChanged || collectionChanged) nextTags.add('collection');
    for (const slug of unique([...beforeCollections, ...afterCollections])) {
      addPage(publicRoute.collection(slug));
    }
  }

  if (collectionChanged) {
    nextTags.add('collection-list');
    nextTags.add('collections');
    addPage(PUBLIC_PAGE_PATHS.collectionsIndex);
    addPage(PUBLIC_PAGE_PATHS.home);
  }

  if (visibilityChanged && beforeCollections.length > 0) {
    nextTags.add('collection-list');
    nextTags.add('collections');
    addPage(PUBLIC_PAGE_PATHS.collectionsIndex);
    addPage(PUBLIC_PAGE_PATHS.home);
  }

  return normalizeCacheImpactPlan({
    source: 'post',
    nextTags: [...nextTags],
    nextPaths: [...paths],
    warmupTargets: warmups,
    cdnPagePaths: [...paths],
    cdnAssetUrls: [],
  });
}

export function collectCollectionCacheImpact(
  context: CollectionCacheImpactContext,
): CacheImpactPlan {
  const paths = new Set<string>([
    publicRoute.collection(context.collectionSlug),
    PUBLIC_PAGE_PATHS.collectionsIndex,
    PUBLIC_PAGE_PATHS.home,
  ]);
  for (const post of context.posts) {
    if (isPublicPost(post as SerializedPost) && post.path) {
      paths.add(publicRoute.post(post.path));
    }
  }

  return normalizeCacheImpactPlan({
    source: 'collection',
    nextTags: ['collection', 'collection-list', 'collections'],
    nextPaths: [...paths],
    warmupTargets: [...paths].map((path) => {
      const post = context.posts.find((candidate) => candidate.path === path);
      return makeWarmupTarget(path, post as SerializedPost | undefined);
    }),
    cdnPagePaths: [...paths],
    cdnAssetUrls: [],
  });
}

function isPublicCollection(
  collection?: CollectionEntityCacheImpactContext['before'],
): boolean {
  return Boolean(collection && collection.status === 1 && collection.is_delete === 0);
}

export function collectCollectionEntityCacheImpact(
  context: CollectionEntityCacheImpactContext,
): CacheImpactPlan {
  const beforePublic = isPublicCollection(context.before);
  const afterPublic = isPublicCollection(context.after);
  if (!beforePublic && !afterPublic) {
    return normalizeCacheImpactPlan({
      source: 'collection',
      nextTags: [],
      nextPaths: [],
      warmupTargets: [],
      cdnPagePaths: [],
      cdnAssetUrls: [],
    });
  }

  const paths = new Set<string>([
    PUBLIC_PAGE_PATHS.home,
    PUBLIC_PAGE_PATHS.collectionsIndex,
  ]);
  const warmups: WarmupTarget[] = [
    makeWarmupTarget(PUBLIC_PAGE_PATHS.home),
    makeWarmupTarget(PUBLIC_PAGE_PATHS.collectionsIndex),
  ];

  if (context.before?.slug && beforePublic) {
    const oldPath = publicRoute.collection(context.before.slug);
    const oldPathRemainsPublic =
      afterPublic && context.after?.slug === context.before.slug;
    paths.add(oldPath);
    warmups.push(makeWarmupTarget(
      oldPath,
      undefined,
      oldPathRemainsPublic ? 'visible' : 'absent',
    ));
  }
  if (context.after?.slug && afterPublic) {
    const newPath = publicRoute.collection(context.after.slug);
    paths.add(newPath);
    warmups.push(makeWarmupTarget(newPath));
  }

  for (const post of context.posts) {
    if (!isPublicPost(post as SerializedPost) || !post.path) continue;
    const path = publicRoute.post(post.path);
    paths.add(path);
    warmups.push(makeWarmupTarget(path, post as SerializedPost));
  }

  return normalizeCacheImpactPlan({
    source: 'collection',
    nextTags: ['collection', 'collection-list', 'collections'],
    nextPaths: [...paths],
    warmupTargets: warmups,
    cdnPagePaths: [...paths],
    cdnAssetUrls: [],
  });
}

export function collectDeployCacheImpact(
  changedFiles: string[],
  catalog: DeployCacheCatalog,
): CacheImpactPlan {
  const paths = new Set<string>();
  const assets = new Set<string>();
  let fullSite = false;

  const addFamily = (prefix: string, values: string[]) => {
    paths.add(prefix);
    for (const value of values) {
      paths.add(`${prefix}/${encodeURIComponent(value)}`);
    }
  };

  for (const rawFile of changedFiles) {
    const file = rawFile.trim().replace(/\\/g, '/');
    if (!file || file.startsWith('docs/') || file.endsWith('.md') || file.includes('.test.')) continue;
    if (file.startsWith('src/app/c/') || file.startsWith('src/app/api/')) continue;

    if (
      file === 'src/app/layout.tsx' ||
      file === 'src/app/globals.css' ||
      file.startsWith('src/contexts/') ||
      file.startsWith('src/components/Header') ||
      file.startsWith('src/components/Footer')
    ) {
      fullSite = true;
      continue;
    }

    if (file.startsWith('public/')) {
      assets.add(`/${file.slice('public/'.length)}`);
      continue;
    }

    if (file.startsWith('src/app/[year]/') || file.includes('ArticleInCollectionItem')) {
      for (const path of catalog.postPaths) paths.add(path);
      continue;
    }
    if (file.startsWith('src/app/tags/') || file.includes('PostListItem')) {
      addFamily('/tags', catalog.tagNames);
      continue;
    }
    if (file.startsWith('src/app/categories/')) {
      addFamily('/categories', catalog.categoryNames);
      continue;
    }
    if (file.startsWith('src/app/archives/') || file.includes('ArchivesList')) {
      paths.add(PUBLIC_PAGE_PATHS.archives);
      continue;
    }
    if (file.startsWith('src/app/collections/') || file.startsWith('src/components/collections/')) {
      addFamily('/collections', catalog.collectionSlugs);
      continue;
    }
    if (file === 'src/app/page.tsx' || file.includes('HomePage')) {
      paths.add(PUBLIC_PAGE_PATHS.home);
      continue;
    }
    if (file === 'src/app/rss.xml/route.ts') {
      paths.add(PUBLIC_PAGE_PATHS.rss);
      continue;
    }
    if (file === 'src/app/sitemap.ts') {
      paths.add(PUBLIC_PAGE_PATHS.sitemap);
      continue;
    }
    if (file.startsWith('src/components/') || file.startsWith('src/lib/site-style/')) {
      fullSite = true;
    }
  }

  if (fullSite) paths.add(PUBLIC_PAGE_PATHS.home);

  return normalizeCacheImpactPlan({
    source: 'deploy',
    nextTags: [],
    nextPaths: [],
    warmupTargets: [...paths].map((path) => makeWarmupTarget(path)),
    cdnPagePaths: [...paths],
    cdnAssetUrls: [...assets],
    cdnFullSite: fullSite,
  });
}
