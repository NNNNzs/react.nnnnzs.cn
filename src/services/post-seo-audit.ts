import { getPrisma } from '@/lib/prisma';
import { getSeoQualityAssessment, type SeoQualityAssessment, type SeoQualityGrade } from '@/lib/seo-content';
import { PUBLIC_POST_WHERE } from '@/lib/post-visibility';
import { serializePost } from '@/services/post';
import type { SerializedPost } from '@/dto/post.dto';

export interface PostSeoAuditRecord extends SeoQualityAssessment {
  id: number;
  path: string;
  title: string | null;
  date: string | null;
  updated: string | null;
  hide: string | null;
  is_delete: number;
}

export interface PostSeoAuditQuery {
  pageNum: number;
  pageSize: number;
  grade?: SeoQualityGrade;
  seoIndexable?: boolean;
  hide?: '0' | '1' | 'all';
}

export interface PostSeoAuditPage {
  record: PostSeoAuditRecord[];
  total: number;
  pageNum: number;
  pageSize: number;
}

function toAuditRecord(post: SerializedPost): PostSeoAuditRecord {
  const assessment = getSeoQualityAssessment({
    title: post.title,
    content: post.content,
    description: post.description,
    category: post.category,
    tags: post.tags,
    seoIndexable: post.seo_indexable,
  });

  return {
    ...assessment,
    id: post.id,
    path: post.path,
    title: post.title,
    date: post.date,
    updated: post.updated,
    hide: post.hide,
    is_delete: post.is_delete,
  };
}

/** Read-only SEO audit. It intentionally computes grades instead of persisting them. */
export async function getPostSeoAuditPage(query: PostSeoAuditQuery): Promise<PostSeoAuditPage> {
  const prisma = await getPrisma();
  const where = query.hide === 'all'
    ? {
        is_delete: 0,
        ...(query.seoIndexable === undefined ? {} : { seo_indexable: query.seoIndexable }),
      }
    : {
        ...(query.hide === '1' ? { ...PUBLIC_POST_WHERE, hide: '1' } : PUBLIC_POST_WHERE),
        ...(query.seoIndexable === undefined ? {} : { seo_indexable: query.seoIndexable }),
      };

  const posts = await prisma.tbPost.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  const records = posts
    .map((post) => toAuditRecord(serializePost(post)))
    .filter((record) => !query.grade || record.grade === query.grade);

  return {
    record: records.slice((query.pageNum - 1) * query.pageSize, query.pageNum * query.pageSize),
    total: records.length,
    pageNum: query.pageNum,
    pageSize: query.pageSize,
  };
}
