import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import {
  getTaskNotificationSnapshot,
  InvalidTaskNotificationCursorError,
} from '@/services/ai-job-notification';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const cursor = request.nextUrl.searchParams.get('cursor');
    const snapshot = await getTaskNotificationSnapshot(check.user, cursor);

    return NextResponse.json(successResponse(snapshot), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    if (error instanceof InvalidTaskNotificationCursorError) {
      return NextResponse.json(errorResponse(error.message), { status: 400 });
    }
    console.error('Query task notifications error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询任务通知失败'),
      { status: 500 },
    );
  }
}
