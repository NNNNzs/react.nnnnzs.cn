'use client';

import { useState } from 'react';
import { useAdaptivePolling } from '@/hooks/useAdaptivePolling';
import { useCrossTabLeader } from '@/hooks/useCrossTabLeader';

type DeployStatusValue = 'deploying' | 'success' | 'failure';

interface DeployStatus {
  status: DeployStatusValue;
  commit: string;
  version: string;
  updatedAt: string;
}

interface DeployStatusApiResponse {
  status: boolean;
  data: DeployStatus | null;
}

interface UseDeployStatusResult {
  status: DeployStatusValue | null;
  commit: string;
  version: string;
  updatedAt: string;
}

const IDLE_POLL_INTERVAL_MS = 120_000;
const DEPLOYING_POLL_INTERVAL_MS = 10_000;

type DeployStatusMessage = { kind: 'snapshot'; value: UseDeployStatusResult };

const EMPTY_DEPLOY_STATUS: UseDeployStatusResult = {
  status: null,
  commit: '',
  version: '',
  updatedAt: '',
};

/**
 * 轮询部署状态
 */
export function useDeployStatus(): UseDeployStatusResult {
  const [deployStatus, setDeployStatus] = useState<UseDeployStatusResult>(EMPTY_DEPLOY_STATUS);
  const { isLeader, broadcast } = useCrossTabLeader<DeployStatusMessage>(
    'deploy-status',
    (message) => {
      if (message.kind === 'snapshot') setDeployStatus(message.value);
    },
    true,
  );

  useAdaptivePolling({
    enabled: process.env.NODE_ENV !== 'development' && isLeader,
    initialJitterMaxMs: 3_000,
    pauseWhenHidden: true,
    refreshOnVisible: true,
    backoffBaseMs: 30_000,
    maxBackoffMs: 300_000,
    poll: async ({ signal }) => {
      const response = await fetch('/api/deploy/status', { signal });
      if (!response.ok) throw new Error(`查询部署状态失败: ${response.status}`);
      const result = (await response.json()) as DeployStatusApiResponse;
      if (!result.status) throw new Error('部署状态响应无效');

      const value = result.data ? {
        status: result.data.status,
        commit: result.data.commit,
        version: result.data.version,
        updatedAt: result.data.updatedAt,
      } : EMPTY_DEPLOY_STATUS;
      setDeployStatus(value);
      broadcast({ kind: 'snapshot', value });
      return value.status === 'deploying' ? DEPLOYING_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
    },
  });

  return deployStatus;
}
