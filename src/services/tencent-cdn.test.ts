import test from 'node:test';
import assert from 'node:assert/strict';
import {
  purgeTencentCdnUrl,
  queryTencentCdnPurgeTasks,
  type TencentCdnPurgeTasksRequest,
} from './tencent-cdn';

test('purgeTencentCdnUrl submits one URL and returns the CDN task id', async () => {
  let urls: string[] = [];

  const result = await purgeTencentCdnUrl(
    'https://www.nnnnzs.cn/2026/08/15/test',
    {
      PurgeUrlsCache: async (input) => {
        urls = input.Urls;
        return { TaskId: 'task-current', RequestId: 'request-current' };
      },
      PurgePathCache: async () => ({}),
      DescribePurgeTasks: async () => ({ PurgeLogs: [], TotalCount: 0 }),
    },
  );

  assert.deepEqual(urls, ['https://www.nnnnzs.cn/2026/08/15/test']);
  assert.equal(result.TaskId, 'task-current');
  assert.equal(result.RequestId, 'request-current');
});

test('queryTencentCdnPurgeTasks maps filters and pagination to the Tencent SDK', async () => {
  let request: TencentCdnPurgeTasksRequest | undefined;

  const result = await queryTencentCdnPurgeTasks(
    {
      startTime: '2026-08-08 00:00:00',
      endTime: '2026-08-15 23:59:59',
      offset: 20,
      limit: 20,
      keyword: 'https://www.nnnnzs.cn/article',
      purgeType: 'url',
      status: 'done',
      area: 'mainland',
    },
    {
      PurgeUrlsCache: async () => ({}),
      PurgePathCache: async () => ({}),
      DescribePurgeTasks: async (input) => {
        request = input;
        return {
          PurgeLogs: [{ TaskId: 'task-1', Status: 'done' }],
          TotalCount: 1,
        };
      },
    },
  );

  assert.deepEqual(request, {
    StartTime: '2026-08-08 00:00:00',
    EndTime: '2026-08-15 23:59:59',
    Offset: 20,
    Limit: 20,
    Keyword: 'https://www.nnnnzs.cn/article',
    PurgeType: 'url',
    Status: 'done',
    Area: 'mainland',
  });
  assert.equal(result.TotalCount, 1);
  assert.equal(result.PurgeLogs?.[0]?.TaskId, 'task-1');
});
