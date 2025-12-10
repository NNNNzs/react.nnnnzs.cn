import { NextRequest, NextResponse } from 'next/server';
import { generDescription } from '@/services/claude';
import { successResponse } from '@/lib/auth';


/**
 * 获取配置详情
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { content } = body;
  const response = await generDescription(content);
  return NextResponse.json(successResponse(response));
}
