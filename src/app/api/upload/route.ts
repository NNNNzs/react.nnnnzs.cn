/**
 * 图片上传API
 * POST /api/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function POST(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token || !(await validateToken(token))) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(errorResponse('未找到文件'), { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        errorResponse('不支持的文件类型，仅支持图片格式'),
        { status: 400 }
      );
    }

    // 验证文件大小（100MB）
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(errorResponse('文件大小不能超过100MB'), {
        status: 400,
      });
    }

    // 生成文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${timestamp}-${randomStr}.${ext}`;

    // 创建上传目录（如果不存在）
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 保存文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // 返回文件URL
    const fileUrl = `/uploads/${filename}`;

    return NextResponse.json(successResponse({ url: fileUrl }, '上传成功'));
  } catch (error) {
    console.error('上传文件失败:', error);
    return NextResponse.json(errorResponse('上传文件失败'), { status: 500 });
  }
}

