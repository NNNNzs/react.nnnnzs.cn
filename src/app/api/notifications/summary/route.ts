import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { getNotificationSummary } from '@/services/notification';

export async function GET(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });
  return NextResponse.json(successResponse(await getNotificationSummary(user.id)));
}
