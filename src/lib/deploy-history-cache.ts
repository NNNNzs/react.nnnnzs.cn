import redisService from '@/lib/redis';

export const DEPLOY_WEBHOOK_HISTORY_KEY = 'deploy:history:webhook';
export const DEPLOY_GITHUB_HISTORY_KEY = 'deploy:history:github';
export const DEPLOY_HISTORY_MAX = 24;

export interface DeployHistoryRecord {
  status: 'deploying' | 'success' | 'failure';
  timestamp: string;
  commit: string;
  version: string;
  runId: string | number;
  url?: string;
  message?: string;
}

const UPSERT_DEPLOY_HISTORY_SCRIPT = `
local history = {}
local current = redis.call('get', KEYS[1])
if current then
  local ok, decoded = pcall(cjson.decode, current)
  if ok and type(decoded) == 'table' then history = decoded end
end
for index = #history, 1, -1 do
  if tostring(history[index]['runId']) == ARGV[1] then
    table.remove(history, index)
  end
end
table.insert(history, 1, cjson.decode(ARGV[2]))
while #history > tonumber(ARGV[3]) do table.remove(history) end
local encoded = cjson.encode(history)
redis.call('set', KEYS[1], encoded)
return encoded
`;

export async function upsertDeployHistory(record: DeployHistoryRecord) {
  await redisService.eval(
    UPSERT_DEPLOY_HISTORY_SCRIPT,
    [DEPLOY_WEBHOOK_HISTORY_KEY],
    [String(record.runId), JSON.stringify(record), String(DEPLOY_HISTORY_MAX)],
  );
}

export function mergeDeployHistories(
  webhookHistory: DeployHistoryRecord[],
  githubHistory: DeployHistoryRecord[],
) {
  const records = new Map<string, DeployHistoryRecord>();
  for (const record of githubHistory) records.set(String(record.runId), record);
  for (const record of webhookHistory) records.set(String(record.runId), record);
  return Array.from(records.values())
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, DEPLOY_HISTORY_MAX);
}
