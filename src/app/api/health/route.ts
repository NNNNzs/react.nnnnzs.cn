/**
 * 健康检查 API
 * 路由: GET /api/health
 * 用于 Docker 健康检查和服务监控
 */

import { NextResponse } from 'next/server';

/**
 * 健康检查端点
 * @returns 返回服务状态信息
 */
export async function GET() {
  try {
    // 检查应用基本状态
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.1.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };

    return NextResponse.json(healthData, { status: 200 });
  } catch (error) {
    // 健康检查失败
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
