import type { SerializedPost } from '@/dto/post.dto';

/** Database predicate for a post that may be shown on public routes. */
export const PUBLIC_POST_WHERE = {
  hide: '0',
  is_delete: 0,
} as const;

/** Database predicate for a post that may be discovered by search engines. */
export const INDEXABLE_POST_WHERE = {
  ...PUBLIC_POST_WHERE,
  seo_indexable: true,
} as const;

export type PostVisibilityRecord = Pick<
  SerializedPost,
  'hide' | 'is_delete' | 'seo_indexable'
>;

export function isPublicPost(post: PostVisibilityRecord | null | undefined): boolean {
  return Boolean(post && post.hide === '0' && post.is_delete === 0);
}

export function isIndexablePost(post: PostVisibilityRecord | null | undefined): boolean {
  return Boolean(isPublicPost(post) && post?.seo_indexable === true);
}
