import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { getNotifications } from '@/services/notification';

export async function GET(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });
  const { searchParams } = request.nextUrl;
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '20');
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  if (!Number.isFinite(page) || !Number.isFinite(pageSize)) return NextResponse.json(errorResponse('分页参数无效'), { status: 400 });
  return NextResponse.json(successResponse(await getNotifications(user.id, { page, pageSize, unreadOnly })));
}
