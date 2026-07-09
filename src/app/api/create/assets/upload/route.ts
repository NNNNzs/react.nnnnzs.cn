import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { CONTENT_CREATE } from '@/constants/permissions';
import { generateUuid } from '@/lib/uuid';
import { uploadFileToCOS } from '@/services/file-upload';
import { createUploadedContentImageAsset } from '@/services/content-creation';

export const runtime = 'nodejs';

const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveImageExtension(filename: string, mimeType: string) {
  const dotIndex = filename.lastIndexOf('.');
  const rawExt = dotIndex > -1 ? filename.slice(dotIndex).toLowerCase() : '';

  if (/^\.[a-z0-9]{2,8}$/.test(rawExt)) {
    return rawExt;
  }

  return MIME_EXTENSIONS[mimeType] ?? '.png';
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_CREATE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const formData = await request.formData();
    const file = formData.get('inputFile') ?? formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(errorResponse('请选择要上传的图片'), { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(errorResponse('素材库只支持上传图片'), { status: 400 });
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(errorResponse('图片不能超过 20MB'), { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = resolveImageExtension(file.name, file.type);
    const cosKey = `/upload/content-assets/${generateUuid()}${ext}`;
    const cdnUrl = await uploadFileToCOS({
      buffer,
      filename: file.name,
      mimetype: file.type,
      key: cosKey,
    });

    const asset = await createUploadedContentImageAsset({
      title: readFormText(formData, 'title'),
      group: readFormText(formData, 'group'),
      cdn_url: cdnUrl,
      cos_key: cosKey,
      originalFilename: file.name,
      mimeType: file.type,
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(asset, '图片素材已上传'), {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('上传图片素材失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '上传图片素材失败'),
      { status: 500 },
    );
  }
}
