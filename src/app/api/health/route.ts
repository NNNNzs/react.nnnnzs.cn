/**
 * 健康检查 API
 * 路由: GET /api/health
 * 用于 Docker 健康检查、服务监控和 Qdrant 心跳保活
 */

import { NextResponse } from 'next/server';
import { getQdrantClient } from '@/lib/qdrant';

/**
 * 健康检查端点
 * 同时触发 Qdrant 心跳，防止免费套餐因不活跃被回收
 * @returns 返回服务状态信息
 */
export async function GET() {
  const healthData: {
    status: string;
    timestamp: string;
    uptime: number;
    environment: string;
    version: string;
    memory: { used: number; total: number; unit: string };
    qdrant: { status: string; latency?: number; error?: string };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    qdrant: { status: 'unknown' },
  };

  // Qdrant 心跳探活，防止免费套餐因不活跃被回收
  // getQdrantClient() 有全局单例缓存（5 分钟），大部分时候直接用缓存的 client
  try {
    const start = Date.now();
    const client = await getQdrantClient();
    await client.getCollections();
    healthData.qdrant = {
      status: 'reachable',
      latency: Date.now() - start,
    };
  } catch (error) {
    healthData.qdrant = {
      status: 'unreachable',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    // Qdrant 不可达不影响整体健康状态，只记录信息
  }

  return NextResponse.json(healthData, { status: 200 });
}
