/**
 * 人脸注册状态查询 API
 * GET /api/face/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    return NextResponse.json(
      successResponse({ registered: !!user.face_person_id }),
    );
  } catch (error) {
    console.error('查询人脸状态失败:', error);
    return NextResponse.json(errorResponse('查询失败'), { status: 500 });
  }
}
