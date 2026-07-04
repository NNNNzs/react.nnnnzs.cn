import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CHAT_LOG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { getAiLabRunDetail, updateAiLabRunFeedback } from '@/services/ai-lab-run';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const getDescriptor: ApiDescriptor = {
  code: 'ai_lab_run_get',
  name: 'AI Lab Run 详情',
  description: '查询 AI Lab 单条 Run 观测详情',
  module: 'ai_lab',
  method: 'GET',
  permissionCode: CHAT_LOG_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Run ID' },
    },
    required: ['id'],
  },
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CHAT_LOG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) {
      return NextResponse.json(errorResponse('无效的 Run ID'), { status: 400 });
    }

    const run = await getAiLabRunDetail(runId);
    if (!run) {
      return NextResponse.json(errorResponse('Run 不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(run), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('查询 AI Lab Run 详情失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询 AI Lab Run 详情失败'),
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CHAT_LOG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) {
      return NextResponse.json(errorResponse('无效的 Run ID'), { status: 400 });
    }

    const body = await request.json();
    const updated = await updateAiLabRunFeedback({
      id: runId,
      feedback: typeof body.feedback === 'string' ? body.feedback : null,
      feedbackNote: typeof body.feedbackNote === 'string' ? body.feedbackNote : null,
    });

    return NextResponse.json(successResponse(updated, '反馈已更新'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('更新 AI Lab Run 反馈失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '更新 AI Lab Run 反馈失败'),
      { status: 500 },
    );
  }
}
