/**
 * AI 图片识别 API
 * POST /api/image-gen/recognize
 * 使用 image_recognition 场景的 OpenAI 兼容多模态模型描述图片。
 */

import { NextRequest, NextResponse } from 'next/server';
import { IMAGE_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import {
  recognizeImage,
  ImageRecognitionValidationError,
  type ImageRecognitionDetail,
  type ImageRecognitionOptions,
} from '@/services/image-recognition';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const descriptor: ApiDescriptor = {
  code: 'image_recognize',
  name: 'AI图片识别',
  description: '使用 image_recognition 场景的多模态模型识别图片并返回中文描述',
  module: 'image',
  method: 'POST',
  permissionCode: IMAGE_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string', description: '图片 URL，支持 http(s) URL 或 data URL' },
      base64: { type: 'string', description: '图片 base64 内容，支持原始 base64 或 data URL' },
      mimeType: { type: 'string', description: 'base64 图片 MIME 类型，默认 image/png' },
      prompt: { type: 'string', description: '识图提示词，默认详细描述图片内容' },
      detail: { type: 'string', description: '图片解析精度：low、high、auto，默认 low' },
      maxTokens: { type: 'number', description: '最大输出 token，默认 800，范围 1-4000' },
    },
  },
};

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  return typeof value === 'number' ? value : undefined;
}

function readDetail(body: Record<string, unknown>): ImageRecognitionDetail | undefined {
  const value = body.detail;
  return typeof value === 'string' ? (value as ImageRecognitionDetail) : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, IMAGE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json() as Record<string, unknown>;
    const options: ImageRecognitionOptions = {
      imageUrl: readString(body, 'imageUrl'),
      base64: readString(body, 'base64'),
      mimeType: readString(body, 'mimeType'),
      prompt: readString(body, 'prompt'),
      detail: readDetail(body),
      maxTokens: readNumber(body, 'maxTokens'),
    };

    const result = await recognizeImage(options);

    return NextResponse.json(successResponse(result, '图片识别完成'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    if (error instanceof ImageRecognitionValidationError) {
      return NextResponse.json(errorResponse(error.message), { status: 400 });
    }

    console.error('图片识别失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '图片识别失败'),
      { status: 500 },
    );
  }
}
