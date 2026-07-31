/**
 * 草稿素材关联迁移。
 *
 * 默认仅检查并打印影响；传入 --apply 才会写入 content_draft_assets，
 * 并从 generation_snapshot_json 中移除 draftImages。
 *
 * 执行顺序：
 * 1. 数据库备份
 * 2. pnpm prisma:push（创建 content_draft_assets）
 * 3. pnpm prisma:migrate:content-draft-assets -- --apply
 */

import { Prisma } from '../src/generated/prisma-client/client';
import { createScriptPrismaClient } from '../scripts/prisma-client';

interface LegacyDraftImage {
  assetId?: unknown;
  sortOrder?: unknown;
  remark?: unknown;
}

interface LegacyAssetDraft {
  id: number;
  draft_id: number;
}

interface TableCount {
  count: bigint | number;
}

const prisma = createScriptPrismaClient();
const shouldApply = process.argv.includes('--apply');

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function countValue(rows: TableCount[]) {
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const [joinTableRows, legacyColumnRows, drafts, assets] = await Promise.all([
    prisma.$queryRaw<TableCount[]>`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'content_draft_assets'
    `,
    prisma.$queryRaw<TableCount[]>`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'content_assets'
        AND column_name = 'draft_id'
    `,
    prisma.contentDraft.findMany({
      select: { id: true, generation_snapshot_json: true },
      orderBy: { id: 'asc' },
    }),
    prisma.contentAsset.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    }),
  ]);

  const joinTableExists = countValue(joinTableRows) > 0;
  const legacyColumnExists = countValue(legacyColumnRows) > 0;
  const legacyAssetDrafts = legacyColumnExists
    ? await prisma.$queryRaw<LegacyAssetDraft[]>`
        SELECT id, draft_id
        FROM content_assets
        WHERE draft_id IS NOT NULL
        ORDER BY id
      `
    : [];

  const draftIds = new Set(drafts.map((draft) => draft.id));
  const assetIds = new Set(assets.map((asset) => asset.id));
  const selections = new Map<number, Array<{ asset_id: number; remark: string | null }>>();
  const invalidReferences: string[] = [];
  const duplicateReferences: string[] = [];
  let legacyJsonCount = 0;

  for (const draft of drafts) {
    const snapshot = asRecord(draft.generation_snapshot_json);
    const rawImages = Array.isArray(snapshot.draftImages)
      ? snapshot.draftImages as LegacyDraftImage[]
      : [];
    const orderedImages = rawImages
      .map((image, index) => ({ image, index }))
      .sort((left, right) => {
        const leftOrder = Number(left.image.sortOrder);
        const rightOrder = Number(right.image.sortOrder);
        return (Number.isInteger(leftOrder) ? leftOrder : left.index + 1)
          - (Number.isInteger(rightOrder) ? rightOrder : right.index + 1);
      });
    const seen = new Set<number>();
    const draftSelections: Array<{ asset_id: number; remark: string | null }> = [];

    for (const { image } of orderedImages) {
      const assetId = Number(image.assetId);
      if (!Number.isInteger(assetId) || assetId <= 0 || !assetIds.has(assetId)) {
        invalidReferences.push(`草稿 ${draft.id} 引用了不存在的素材 ${String(image.assetId)}`);
        continue;
      }
      if (seen.has(assetId)) {
        duplicateReferences.push(`草稿 ${draft.id} 重复引用素材 ${assetId}`);
        continue;
      }
      seen.add(assetId);
      const remark = typeof image.remark === 'string' ? image.remark.trim() || null : null;
      draftSelections.push({ asset_id: assetId, remark });
      legacyJsonCount += 1;
    }
    selections.set(draft.id, draftSelections);
  }

  for (const legacy of legacyAssetDrafts) {
    if (!draftIds.has(legacy.draft_id) || !assetIds.has(legacy.id)) {
      invalidReferences.push(`素材 ${legacy.id} 的旧 draft_id=${legacy.draft_id} 无效`);
      continue;
    }
    const draftSelections = selections.get(legacy.draft_id) ?? [];
    if (!draftSelections.some((item) => item.asset_id === legacy.id)) {
      draftSelections.push({ asset_id: legacy.id, remark: null });
      selections.set(legacy.draft_id, draftSelections);
    }
  }

  const relationCount = Array.from(selections.values())
    .reduce((total, items) => total + items.length, 0);
  const draftsWithLegacyJson = drafts.filter((draft) => (
    Array.isArray(asRecord(draft.generation_snapshot_json).draftImages)
  )).length;

  console.log([
    `模式：${shouldApply ? '写入' : '只读检查'}`,
    `草稿数：${drafts.length}`,
    `素材数：${assets.length}`,
    `JSON 图片使用记录：${legacyJsonCount}`,
    `旧 draft_id 记录：${legacyAssetDrafts.length}`,
    `待建立关联：${relationCount}`,
    `待清理 draftImages 的草稿：${draftsWithLegacyJson}`,
    `关联表已存在：${joinTableExists ? '是' : '否'}`,
  ].join('\n'));

  if (invalidReferences.length || duplicateReferences.length) {
    for (const message of [...invalidReferences, ...duplicateReferences]) {
      console.error(`- ${message}`);
    }
    throw new Error('迁移检查失败，请先处理无效或重复引用');
  }

  if (!shouldApply) {
    console.log('检查通过。确认数据库备份和上述影响后，可追加 --apply 执行写入。');
    return;
  }
  if (!joinTableExists) {
    throw new Error('content_draft_assets 尚不存在，请先执行 pnpm prisma:push');
  }

  await prisma.$transaction(async (tx) => {
    for (const [draftId, items] of selections) {
      for (const [index, item] of items.entries()) {
        await tx.contentDraftAsset.upsert({
          where: {
            uk_draft_asset: {
              draft_id: draftId,
              asset_id: item.asset_id,
            },
          },
          create: {
            draft_id: draftId,
            asset_id: item.asset_id,
            sort_order: index + 1,
            remark: item.remark,
          },
          update: {
            sort_order: index + 1,
            remark: item.remark,
          },
        });
      }
    }

    for (const draft of drafts) {
      const snapshot = asRecord(draft.generation_snapshot_json);
      if (!Object.prototype.hasOwnProperty.call(snapshot, 'draftImages')) continue;
      delete snapshot.draftImages;
      await tx.contentDraft.update({
        where: { id: draft.id },
        data: {
          generation_snapshot_json: Object.keys(snapshot).length
            ? snapshot as Prisma.InputJsonObject
            : Prisma.JsonNull,
        },
      });
    }
  });

  console.log(`迁移完成：写入或更新 ${relationCount} 条关联，清理 ${draftsWithLegacyJson} 个草稿快照。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
