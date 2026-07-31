import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContentDraftAssetValidationError,
  getRemovedDraftAssetIds,
  hasDraftAssetSelections,
  normalizeDraftAssetSelections,
} from './content-draft-assets';

test('按数组顺序规范化草稿素材并清理备注', () => {
  assert.deepEqual(
    normalizeDraftAssetSelections([
      { asset_id: 9, remark: ' 封面 ' },
      { asset_id: 12, remark: ' ' },
    ]),
    [
      { asset_id: 9, remark: '封面', sort_order: 1 },
      { asset_id: 12, remark: null, sort_order: 2 },
    ],
  );
});

test('空数组表示解除全部素材关联', () => {
  assert.deepEqual(normalizeDraftAssetSelections([]), []);
  assert.deepEqual(getRemovedDraftAssetIds([3, 5], []), [3, 5]);
  assert.equal(hasDraftAssetSelections([]), false);
  assert.equal(hasDraftAssetSelections(undefined), false);
  assert.equal(hasDraftAssetSelections([{ asset_id: 3 }]), true);
});

test('完整替换只移除新数组中不存在的素材', () => {
  assert.deepEqual(getRemovedDraftAssetIds([3, 5, 8], [8, 3, 13]), [5]);
});

test('拒绝同一草稿重复关联同一个素材', () => {
  assert.throws(
    () => normalizeDraftAssetSelections([{ asset_id: 7 }, { asset_id: 7 }]),
    (error) => (
      error instanceof ContentDraftAssetValidationError
      && /不能重复关联/.test(error.message)
    ),
  );
});

test('拒绝无效素材 ID', () => {
  assert.throws(
    () => normalizeDraftAssetSelections([{ asset_id: 0 }]),
    (error) => (
      error instanceof ContentDraftAssetValidationError
      && /素材 ID 无效/.test(error.message)
    ),
  );
});
