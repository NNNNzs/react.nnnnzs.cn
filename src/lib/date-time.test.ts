import test from 'node:test';
import assert from 'node:assert/strict';
import { formatShanghaiDateTime } from './date-time';

test('formatShanghaiDateTime renders ISO UTC timestamps as East-8 diagnostics', () => {
  assert.equal(
    formatShanghaiDateTime('2026-08-15T06:46:43.000Z'),
    '2026-08-15 14:46:43',
  );
});
