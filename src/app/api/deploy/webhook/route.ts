/**
 * 部署状态 Webhook
 * POST /api/deploy/webhook
 */
import { NextRequest, NextResponse } from 'next/server';

import { successResponse, errorResponse } from '@/dto/response.dto';
import redisService from '@/lib/redis';
import { upsertDeployHistory } from '@/lib/deploy-history-cache';
import { isWebhookAuthorized } from '@/lib/webhook-auth';

export const runtime = 'nodejs';

const DEPLOY_STATUS_KEY = 'deploy:status';
const DEPLOY_STATUS_TTL_SECONDS = 60 * 60;
const DEPLOY_STATUS_VALUES = new Set(['deploying', 'success', 'failure']);

interface DeployStatusWebhookPayload {
  status: 'deploying' | 'success' | 'failure';
  run_id: string;
  commit: string;
  version: string;
}

interface DeployStatusRecord {
  status: DeployStatusWebhookPayload['status'];
  runId: string;
  commit: string;
  version: string;
  updatedAt: string;
}

/**
 * 判断部署状态 webhook payload 是否有效
 */
function isDeployStatusPayload(value: unknown): value is DeployStatusWebhookPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.status === 'string' &&
    DEPLOY_STATUS_VALUES.has(payload.status) &&
    typeof payload.run_id === 'string' &&
    typeof payload.commit === 'string' &&
    typeof payload.version === 'string'
  );
}

/**
 * 接收 GitHub Actions 部署状态通知
 */
export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.DEPLOY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
    if (!isWebhookAuthorized(request.headers.get('authorization'), expectedToken)) {
      return NextResponse.json(errorResponse('无效的 Webhook Token'), { status: 401 });
    }

    const payload = (await request.json()) as unknown;

    if (!isDeployStatusPayload(payload)) {
      return NextResponse.json(errorResponse('部署状态 payload 无效'), { status: 400 });
    }

    const deployStatus: DeployStatusRecord = {
      status: payload.status,
      runId: payload.run_id,
      commit: payload.commit,
      version: payload.version,
      updatedAt: new Date().toISOString(),
    };

    await redisService.setex(
      DEPLOY_STATUS_KEY,
      DEPLOY_STATUS_TTL_SECONDS,
      JSON.stringify(deployStatus)
    );

    const historyRecord = {
      status: deployStatus.status,
      timestamp: deployStatus.updatedAt,
      commit: deployStatus.commit,
      version: deployStatus.version,
      runId: deployStatus.runId,
    };
    await upsertDeployHistory(historyRecord);

    return NextResponse.json(successResponse(deployStatus, '部署状态已更新'));
  } catch (error) {
    console.error('写入部署状态失败:', error);
    return NextResponse.json(errorResponse('写入部署状态失败'), { status: 500 });
  }
}
