'use client';

import { useEffect, useState } from 'react';

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

const POLLING_INTERVAL_MS = 30_000;

/**
 * 轮询部署状态
 */
export function useDeployStatus(): UseDeployStatusResult {
  const [deployStatus, setDeployStatus] = useState<UseDeployStatusResult>({
    status: null,
    commit: '',
    version: '',
    updatedAt: '',
  });

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    let isActive = true;
    let abortController: AbortController | null = null;

    const fetchDeployStatus = async () => {
      try {
        abortController?.abort();
        abortController = new AbortController();

        const response = await fetch('/api/deploy/status', {
          cache: 'no-store',
          signal: abortController.signal,
        });

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as DeployStatusApiResponse;

        if (!isActive) {
          return;
        }

        if (!result.status || !result.data) {
          setDeployStatus({
            status: null,
            commit: '',
            version: '',
            updatedAt: '',
          });
          return;
        }

        setDeployStatus({
          status: result.data.status,
          commit: result.data.commit,
          version: result.data.version,
          updatedAt: result.data.updatedAt,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
      }
    };

    fetchDeployStatus();
    const intervalId = window.setInterval(fetchDeployStatus, POLLING_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      abortController?.abort();
    };
  }, []);

  return deployStatus;
}
