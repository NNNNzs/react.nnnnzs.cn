import { NextRequest, NextResponse } from 'next/server';
import { IMAGE_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { generateUuid } from '@/lib/uuid';
import { uploadFileToCOS } from '@/services/file-upload';

export const runtime = 'nodejs';

const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function resolveImageExtension(filename: string, mimeType: string) {
  const dotIndex = filename.lastIndexOf('.');
  const rawExt = dotIndex > -1 ? filename.slice(dotIndex).toLowerCase() : '';
  return /^\.[a-z0-9]{2,8}$/.test(rawExt) ? rawExt : (MIME_EXTENSIONS[mimeType] ?? '.png');
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, IMAGE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const formData = await request.formData();
    const file = formData.get('file') ?? formData.get('inputFile');
    if (!(file instanceof File)) {
      return NextResponse.json(errorResponse('请选择参考图片'), { status: 400 });
    }
    if (!MIME_EXTENSIONS[file.type]) {
      return NextResponse.json(errorResponse('仅支持 PNG、JPEG、WebP、GIF 图片'), { status: 400 });
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(errorResponse('参考图片不能超过 20MB'), { status: 400 });
    }

    const ext = resolveImageExtension(file.name, file.type);
    const cosKey = `/upload/image-references/${generateUuid()}${ext}`;
    const imageUrl = await uploadFileToCOS({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      mimetype: file.type,
      key: cosKey,
    });

    return NextResponse.json(successResponse({ imageUrl, cosKey }, '参考图片已上传'), {
      status: 201,
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('上传参考图片失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '上传参考图片失败'),
      { status: 500 },
    );
  }
}
