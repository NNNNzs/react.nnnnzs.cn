/**
 * 部署状态 Webhook
 * POST /api/deploy/webhook
 */
import { NextRequest, NextResponse } from 'next/server';

import { successResponse, errorResponse } from '@/dto/response.dto';
import redisService from '@/lib/redis';

export const runtime = 'nodejs';

const DEPLOY_STATUS_KEY = 'deploy:status';
const DEPLOY_HISTORY_KEY = 'deploy:history';
const DEPLOY_HISTORY_MAX = 24;
const DEPLOY_STATUS_TTL_SECONDS = 60 * 60;
const DEPLOY_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 7;
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
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

    if (!expectedToken || token !== expectedToken) {
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
    };

    const existing = await redisService.get(DEPLOY_HISTORY_KEY);
    const history: unknown[] = existing ? JSON.parse(existing as string) : [];
    history.unshift(historyRecord);
    if (history.length > DEPLOY_HISTORY_MAX) {
      history.length = DEPLOY_HISTORY_MAX;
    }
    await redisService.setex(
      DEPLOY_HISTORY_KEY,
      DEPLOY_HISTORY_TTL_SECONDS,
      JSON.stringify(history)
    );

    return NextResponse.json(successResponse(deployStatus, '部署状态已更新'));
  } catch (error) {
    console.error('写入部署状态失败:', error);
    return NextResponse.json(errorResponse('写入部署状态失败'), { status: 500 });
  }
}
