/**
 * 人脸注册 API
 * POST /api/face/register - 注册/更新人脸
 * DELETE /api/face/register - 删除人脸注册
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';
import { createPerson, deletePerson, toPersonId } from '@/services/face';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const { image } = await request.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json(errorResponse('请提供人脸图片'), { status: 400 });
    }

    // 去除 data:image/...;base64, 前缀
    const base64Data = image.replace(/^data:image\/[^;]+;base64,/, '');
    const personId = toPersonId(user.id);

    // 始终尝试删除已有人员（处理上次注册中途失败、数据库与腾讯云不一致等情况）
    try {
      await deletePerson(personId);
    } catch {
      // 人员不存在时忽略错误
    }

    // 创建新人员
    const nickname = user.nickname || user.account;
    await createPerson(personId, nickname, base64Data);

    // 更新数据库
    const prisma = await getPrisma();
    await prisma.tbUser.update({
      where: { id: user.id },
      data: { face_person_id: personId },
    });

    return NextResponse.json(successResponse(null, '人脸注册成功'));
  } catch (error) {
    console.error('人脸注册失败:', error);
    const msg = error instanceof Error ? error.message : '人脸注册失败';
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const personId = toPersonId(user.id);

    // 始终尝试从腾讯云删除
    try {
      await deletePerson(personId);
    } catch {
      // 人员不存在时忽略错误
    }

    // 清空数据库字段
    const prisma = await getPrisma();
    await prisma.tbUser.update({
      where: { id: user.id },
      data: { face_person_id: null },
    });

    return NextResponse.json(successResponse(null, '人脸注册已删除'));
  } catch (error) {
    console.error('删除人脸注册失败:', error);
    const msg = error instanceof Error ? error.message : '删除失败';
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
