import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { CHAT_LOG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { getAiLabRuns } from '@/services/ai-lab-run';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

export const descriptor: ApiDescriptor = {
  code: 'ai_lab_runs_list',
  name: 'AI Lab Run 列表',
  description: '查询 AI Lab 结构化 Run 观测记录',
  module: 'ai_lab',
  method: 'GET',
  permissionCode: CHAT_LOG_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码' },
      pageSize: { type: 'number', description: '每页数量' },
      keyword: { type: 'string', description: '关键词' },
      model: { type: 'string', description: '模型筛选' },
      toolName: { type: 'string', description: '首个工具名' },
      hasTool: { type: 'string', description: '是否有工具调用：true / false' },
      hasError: { type: 'string', description: '是否有错误：true / false' },
    },
  },
};

function parseBoolean(value: string | null) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CHAT_LOG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { searchParams } = new URL(request.url);
    const result = await getAiLabRuns({
      pageNum: parseInt(searchParams.get('pageNum') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      source: searchParams.get('source') || undefined,
      userId: searchParams.get('userId') ? parseInt(searchParams.get('userId')!, 10) : undefined,
      deviceId: searchParams.get('deviceId') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      model: searchParams.get('model') || undefined,
      toolName: searchParams.get('toolName') || undefined,
      hasTool: parseBoolean(searchParams.get('hasTool')),
      hasError: parseBoolean(searchParams.get('hasError')),
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    return NextResponse.json(successResponse(result), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('查询 AI Lab Run 失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询 AI Lab Run 失败'),
      { status: 500 },
    );
  }
}
