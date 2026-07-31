import { z } from 'zod';

export interface DraftAssetSelectionInput {
  asset_id: number;
  remark?: string | null;
}

export interface NormalizedDraftAssetSelection {
  asset_id: number;
  remark: string | null;
  sort_order: number;
}

const MAX_DRAFT_ASSETS = 100;

export class ContentDraftAssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentDraftAssetValidationError';
  }
}

export class ContentDraftAssetPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentDraftAssetPermissionError';
  }
}

export const draftAssetsSchema = z.array(z.object({
  asset_id: z.coerce.number().int().positive(),
  remark: z.string().max(500).optional().nullable(),
}).strict()).max(MAX_DRAFT_ASSETS);

export const draftAssetsInputSchema = {
  type: 'array',
  description: '草稿关联素材；数组顺序决定展示顺序，传空数组解除全部关联',
  items: {
    type: 'object',
    properties: {
      asset_id: { type: 'number', description: '图片素材 ID' },
      remark: { type: 'string', description: '该素材在当前草稿中的备注' },
    },
    required: ['asset_id'],
  },
};

export function normalizeDraftAssetSelections(
  assets: DraftAssetSelectionInput[],
): NormalizedDraftAssetSelection[] {
  if (assets.length > MAX_DRAFT_ASSETS) {
    throw new ContentDraftAssetValidationError(`单个草稿最多关联 ${MAX_DRAFT_ASSETS} 个素材`);
  }

  const seen = new Set<number>();

  return assets.map((item, index) => {
    if (!Number.isInteger(item.asset_id) || item.asset_id <= 0) {
      throw new ContentDraftAssetValidationError(`第 ${index + 1} 个素材 ID 无效`);
    }
    if (seen.has(item.asset_id)) {
      throw new ContentDraftAssetValidationError(`素材 ${item.asset_id} 在同一草稿中不能重复关联`);
    }
    seen.add(item.asset_id);

    const remark = item.remark?.trim();
    return {
      asset_id: item.asset_id,
      remark: remark || null,
      sort_order: index + 1,
    };
  });
}

export function getRemovedDraftAssetIds(existingAssetIds: number[], nextAssetIds: number[]) {
  const nextIds = new Set(nextAssetIds);
  return existingAssetIds.filter((assetId) => !nextIds.has(assetId));
}

export function hasDraftAssetSelections(
  assets: readonly DraftAssetSelectionInput[] | null | undefined,
) {
  return Boolean(assets?.length);
}
