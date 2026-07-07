import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/dto/response.dto';

export function validationErrorResponse(error: z.ZodError) {
  const message = error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  return NextResponse.json(
    errorResponse(`输入验证失败: ${message}`),
    { status: 400 },
  );
}

export function getNumberParam(value: string | null) {
  if (!value) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function getStringParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
