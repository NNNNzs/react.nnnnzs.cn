import { getPrisma } from '@/lib/prisma';
import {
  createPreviewShareToken,
  hashPreviewShareToken,
  isPreviewShareActive,
  toPublicDraftPreviewDto,
} from '@/lib/content-draft-preview';
import type { DraftPreviewShareView, PublicDraftPreviewDto } from '@/types/content-draft-preview';

function toShareView(share: {
  id: number;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}): DraftPreviewShareView {
  return {
    id: share.id,
    expiresAt: share.expires_at,
    revokedAt: share.revoked_at,
    createdAt: share.created_at,
    active: isPreviewShareActive(share),
  };
}

export async function listContentDraftPreviewShares(draftId: number): Promise<DraftPreviewShareView[]> {
  const prisma = await getPrisma();
  const shares = await prisma.contentDraftPreviewShare.findMany({
    where: { draft_id: draftId },
    select: { id: true, expires_at: true, revoked_at: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  return shares.map(toShareView);
}

export async function createContentDraftPreviewShare(params: {
  draftId: number;
  createdBy: number | null;
  expiresAt?: Date | null;
  rotate?: boolean;
}): Promise<{ token: string; share: DraftPreviewShareView }> {
  const prisma = await getPrisma();
  const token = createPreviewShareToken();
  const now = new Date();
  const share = await prisma.$transaction(async (tx) => {
    if (params.rotate !== false) {
      await tx.contentDraftPreviewShare.updateMany({
        where: { draft_id: params.draftId, revoked_at: null },
        data: { revoked_at: now },
      });
    }
    return tx.contentDraftPreviewShare.create({
      data: {
        draft_id: params.draftId,
        token_hash: hashPreviewShareToken(token),
        created_by: params.createdBy,
        expires_at: params.expiresAt ?? null,
      },
      select: { id: true, expires_at: true, revoked_at: true, created_at: true },
    });
  });
  return { token, share: toShareView(share) };
}

export async function revokeContentDraftPreviewShares(draftId: number): Promise<number> {
  const prisma = await getPrisma();
  const result = await prisma.contentDraftPreviewShare.updateMany({
    where: { draft_id: draftId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  return result.count;
}

/** Looks up the share and the draft with an intentionally public-only Prisma projection. */
export async function getPublicContentDraftPreview(token: string): Promise<PublicDraftPreviewDto | null> {
  const prisma = await getPrisma();
  const now = new Date();
  const share = await prisma.contentDraftPreviewShare.findUnique({
    where: { token_hash: hashPreviewShareToken(token) },
    select: {
      expires_at: true,
      revoked_at: true,
      draft: {
        select: {
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
      },
    },
  });
  if (!share || !isPreviewShareActive(share, now)) return null;
  return toPublicDraftPreviewDto(share.draft);
}
