/**
 * 部署状态查询 API
 * GET /api/deploy/status
 */
import { NextResponse } from 'next/server';

import { successResponse, errorResponse } from '@/dto/response.dto';
import redisService from '@/lib/redis';

export const runtime = 'nodejs';

const DEPLOY_STATUS_KEY = 'deploy:status';

interface DeployStatusPayload {
  status: 'deploying' | 'success' | 'failure';
  runId: string;
  commit: string;
  version: string;
  updatedAt: string;
}

/**
 * 读取当前部署状态
 */
export async function GET() {
  try {
    const cachedStatus = await redisService.get(DEPLOY_STATUS_KEY);

    if (!cachedStatus) {
      return NextResponse.json(successResponse<DeployStatusPayload | null>(null));
    }

    const deployStatus = JSON.parse(cachedStatus) as DeployStatusPayload;
    return NextResponse.json(successResponse(deployStatus));
  } catch (error) {
    console.error('读取部署状态失败:', error);
    return NextResponse.json(errorResponse('读取部署状态失败'), { status: 500 });
  }
}
