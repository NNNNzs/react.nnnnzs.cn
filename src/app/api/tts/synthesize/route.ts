/**
 * TTS 语音合成 API
 * POST /api/tts/synthesize
 * 创建 TTS 语音合成异步任务
 * 立即返回 jobId、预分配 CDN URL 和 MCP resourceUri
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { TTS_VIEW } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'tts_synthesize',
  name: '语音合成',
  description: '创建 TTS 语音合成异步任务，立即返回 jobId、预分配 CDN URL 和 MCP resourceUri',
  module: 'tts',
  method: 'POST',
  permissionCode: TTS_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要合成的文本' },
      model: { type: 'string', description: 'TTS 模型' },
      voice: { type: 'string', description: '音色名称' },
      instruction: { type: 'string', description: '风格指令' },
    },
    required: ['text'],
  },
};

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, TTS_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    // 解析请求体
    const body = await request.json();
    const {
      text,
      model,
      voice,
      instruction,
    } = body;

    // 快速校验
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(errorResponse('合成文本不能为空'), { status: 400 });
    }

    try {
      const { createTTSJob } = await import('@/services/tts-job');
      const job = await createTTSJob({
        options: {
          text: text.trim(),
          model,
          voice,
          instruction,
        },
        userId: check.user.id,
        source: 'ADMIN',
      });

      return NextResponse.json(
        successResponse(job, '语音合成任务已提交'),
        {
          status: 202,
          headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
          },
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '语音合成任务创建失败';
      return NextResponse.json(errorResponse(errorMessage), { status: 500 });
    }
  } catch (error) {
    console.error('TTS synthesis error:', error);
    const errorMessage = error instanceof Error ? error.message : '语音合成失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
