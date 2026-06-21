/**
 * 人脸登录 API
 * POST /api/face/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateToken, storeToken, setAuthCookie } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';
import { searchFaces, fromPersonId } from '@/services/face';

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json(errorResponse('请提供人脸图片'), { status: 400 });
    }

    // 去除 base64 前缀
    const base64Data = image.replace(/^data:image\/[^;]+;base64,/, '');

    // 在人员库中搜索匹配人脸
    const match = await searchFaces(base64Data);
    if (!match) {
      return NextResponse.json(errorResponse('未识别到已注册人脸'), { status: 401 });
    }

    // 从 PersonId 解析用户 ID
    const userId = fromPersonId(match.personId);
    if (!userId) {
      return NextResponse.json(errorResponse('人员ID格式异常'), { status: 500 });
    }

    // 查询用户
    const prisma = await getPrisma();
    const user = await prisma.tbUser.findUnique({ where: { id: userId } });
    if (!user || user.status !== 1) {
      return NextResponse.json(errorResponse('用户不存在或已禁用'), { status: 401 });
    }

    // 生成 Token 并存储
    const token = generateToken();
    await storeToken(token, user as never);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userInfo } = user;

    const response = NextResponse.json(
      successResponse({ token, userInfo }, '人脸登录成功'),
    );

    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('人脸登录失败:', error);
    const msg = error instanceof Error ? error.message : '人脸登录失败';
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
