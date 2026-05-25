/**
 * 文件上传 API
 * POST /api/fs/upload
 * 上传文件到腾讯云 COS
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { uploadFileToCOS } from '@/services/file-upload';
import { FILE_UPLOAD } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'upload_file',
  name: '上传附件',
  description: '上传附件到腾讯云 COS，MCP 调用时传入 base64 文件内容、文件名和 MIME 类型，返回 CDN URL。',
  module: 'upload',
  method: 'POST',
  permissionCode: FILE_UPLOAD,
  inputSchema: {
    type: 'object',
    properties: {
      base64: { type: 'string', description: 'base64 编码的文件内容，支持带 data URL 前缀' },
      url: { type: 'string', description: '公网可访问的文件 URL；传 url 时服务端会下载并转存到 COS' },
      filename: { type: 'string', description: '文件名，例如 image.png、report.pdf' },
      mimeType: { type: 'string', description: '文件 MIME 类型，例如 image/png、application/pdf' },
      ext: { type: 'string', description: '可选文件扩展名，例如 png、pdf；未传时从 filename 推断' },
    },
  },
};

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

    const fileData = {
      buffer,
      filename: file.name,
      mimetype: file.type,
    };

    // 上传到 COS
    const url = await uploadFileToCOS(fileData);

    return NextResponse.json(successResponse(url));
  } catch (error) {
    console.error('文件上传失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '文件上传失败'),
      { status: 500 }
    );
  }
}
