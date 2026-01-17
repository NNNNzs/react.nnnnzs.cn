/**
 * 向量化队列状态查询 API
 * GET /api/post/embed/queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStatus, embeddingQueue } from '@/services/embedding';
import { getTokenFromRequest, validateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * GET /api/post/embed/queue
 * 查询向量化队列状态
 */
export async function GET(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    const user = token ? await validateToken(token) : null;

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    // 获取队列状态
    const queueStatus = getQueueStatus();

    return NextResponse.json(
      successResponse({
        ...queueStatus,
        isRunning: true, // 队列应该在应用启动时自动启动
      })
    );
  } catch (error) {
    console.error('查询队列状态失败:', error);
    const errorMessage = error instanceof Error ? error.message : '查询失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
