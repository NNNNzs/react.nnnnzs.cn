import { getPrisma } from '@/lib/prisma';
import { toPublicDraftPreviewDto } from '@/lib/content-draft-preview';
import type { PublicDraftPreviewDto } from '@/types/content-draft-preview';

/** Looks up a draft with an intentionally public-only Prisma projection. */
export async function getPublicContentDraftPreview(draftId: number): Promise<PublicDraftPreviewDto | null> {
  const prisma = await getPrisma();
  const draft = await prisma.contentDraft.findUnique({
    where: { id: draftId },
    select: {
      type: true,
      title: true,
      hook: true,
      body: true,
      tags_json: true,
      updated_at: true,
      assets: {
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
        select: {
          sort_order: true,
          created_at: true,
          asset: { select: { type: true, title: true, cdn_url: true } },
        },
      },
    },
  });
  return draft ? toPublicDraftPreviewDto(draft) : null;
}
