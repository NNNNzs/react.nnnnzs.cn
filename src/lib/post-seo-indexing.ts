import { z } from 'zod';

export const MAX_BATCH_SEO_INDEXING_POSTS = 50;

export const batchSeoIndexingSchema = z.object({
  postIds: z.array(z.number().int().positive())
    .min(1)
    .max(MAX_BATCH_SEO_INDEXING_POSTS)
    .refine(
      (postIds) => new Set(postIds).size === postIds.length,
      'postIds 不能包含重复 ID',
    ),
  seoIndexable: z.boolean(),
});
