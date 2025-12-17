/**
 * 文件上传 API
 * POST /api/fs/upload
 * 上传文件到腾讯云 COS
 */

import { NextRequest, NextResponse } from 'next/server';
import { extname } from 'path';
import { createHash } from 'crypto';
import COS from 'cos-nodejs-sdk-v5';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
/**
 * 初始化 COS 客户端
 */
function getCosClient() {
  const SecretId = process.env.SecretId || process.env.COS_SECRET_ID;
  const SecretKey = process.env.SecretKey || process.env.COS_SECRET_KEY;

  if (!SecretId || !SecretKey) {
    throw new Error('COS 配置缺失：SecretId 或 SecretKey');
  }

  return new COS({
    SecretId,
    SecretKey,
  });
}

/**
 * 上传文件到 COS
 */
async function uploadToCOS(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<string> {
  const Bucket = process.env.Bucket || process.env.COS_BUCKET;
  const Region = process.env.Region || process.env.COS_REGION;
  const CDN_URL = process.env.CDN_URL || process.env.COS_CDN_URL;

  if (!Bucket || !Region || !CDN_URL) {
    throw new Error('COS 配置缺失：Bucket、Region 或 CDN_URL');
  }

  const cos = getCosClient();

  // 生成文件路径
  const ext = extname(file.originalname) || '.png';
  const md5Name = createHash('md5')
    .update(file.buffer)
    .digest('hex');
  const Key = `/upload/${md5Name}${ext}`;

  // 处理文件名编码
  const fileName = encodeURIComponent(
    Buffer.from(file.originalname, 'latin1').toString('utf-8')
  );

  // 上传到 COS
  const result = await cos.putObject({
    Bucket,
    Region,
    Key,
    Body: file.buffer,
    'x-cos-meta-filename': fileName,
  });

  if (result.statusCode === 200) {
    return `${CDN_URL}${Key}`;
  } else {
    throw new Error(`上传失败: ${result.statusCode}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证 Token（需要登录才能上传）
    const token = getTokenFromRequest(request.headers);
    if (!token || !(await validateToken(token))) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('inputFile') as File;

    if (!file) {
      return NextResponse.json(errorResponse('未找到文件'), { status: 400 });
    }

    // 将 File 转换为 Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 创建临时文件对象
    const fileData = {
      buffer,
      originalname: file.name,
      mimetype: file.type,
    };

    // 上传到 COS
    const url = await uploadToCOS(fileData);

    return NextResponse.json(successResponse(url));
  } catch (error) {
    console.error('文件上传失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '文件上传失败'),
      { status: 500 }
    );
  }
}

