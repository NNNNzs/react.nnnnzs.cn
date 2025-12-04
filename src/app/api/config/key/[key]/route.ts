/**
 * 根据 key 获取配置API
 * GET /api/config/key/[key]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigByKey } from '@/services/config';
import { successResponse, errorResponse } from '@/lib/auth';

/**
 * 根据 key 获取配置
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params;

    const config = await getConfigByKey(key);

    if (!config) {
      return NextResponse.json(errorResponse('配置不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(config));
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json(errorResponse('获取配置失败'), {
      status: 500,
    });
  }
}
