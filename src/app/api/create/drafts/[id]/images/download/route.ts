import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import { createStoredZip, type StoredZipEntry } from '@/lib/zip';
import { getContentDraft, type DraftImageItem } from '@/services/content-creation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const IMAGE_EXTENSION_BY_TYPE = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
]);

async function readDraftId(context: RouteContext) {
  const { id } = await context.params;
  const draftId = Number(id);
  return Number.isInteger(draftId) && draftId > 0 ? draftId : null;
}

function sanitizeFileName(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return cleaned || fallback;
}

function getImageExtension(imageUrl: string, contentType: string | null) {
  const normalizedType = contentType?.split(';')[0]?.trim().toLowerCase();
  if (normalizedType && IMAGE_EXTENSION_BY_TYPE.has(normalizedType)) {
    return IMAGE_EXTENSION_BY_TYPE.get(normalizedType) ?? '.png';
  }

  try {
    const path = new URL(imageUrl).pathname.toLowerCase();
    const match = path.match(/\.(png|jpe?g|webp|gif|avif)$/);
    if (match?.[1]) {
      return match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`;
    }
  } catch {
    return '.png';
  }

  return '.png';
}

function createUniqueFileName(baseName: string, usedNames: Set<string>) {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  const extensionIndex = baseName.lastIndexOf('.');
  const name = extensionIndex >= 0 ? baseName.slice(0, extensionIndex) : baseName;
  const extension = extensionIndex >= 0 ? baseName.slice(extensionIndex) : '';
  let index = 2;
  let nextName = `${name}-${index}${extension}`;

  while (usedNames.has(nextName)) {
    index += 1;
    nextName = `${name}-${index}${extension}`;
  }

  usedNames.add(nextName);
  return nextName;
}

function encodeContentDispositionFileName(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_') || 'draft-images.zip';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function fetchImageEntry(image: DraftImageItem, index: number, usedNames: Set<string>): Promise<StoredZipEntry> {
  const response = await fetch(image.imageUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`图片下载失败：${image.title || `素材 ${image.assetId}`}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  const extension = getImageExtension(image.imageUrl, response.headers.get('content-type'));
  const title = sanitizeFileName(image.title || `asset-${image.assetId}`, `asset-${image.assetId}`);
  const baseName = `${String(index + 1).padStart(2, '0')}-${title}${extension}`;

  return {
    name: createUniqueFileName(baseName, usedNames),
    data,
  };
}

function createManifest(draft: NonNullable<Awaited<ReturnType<typeof getContentDraft>>>) {
  return {
    draft: {
      id: draft.id,
      title: draft.title,
      type: draft.type,
      status: draft.status,
    },
    exportedAt: new Date().toISOString(),
    images: draft.selected_images.map((image) => ({
      id: image.id,
      assetId: image.assetId,
      title: image.title,
      imageUrl: image.imageUrl,
      group: image.group,
      sortOrder: image.sortOrder,
      remark: image.remark,
      addedAt: image.addedAt,
    })),
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const draftId = await readDraftId(context);
    if (!draftId) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const draft = await getContentDraft(draftId);
    if (!draft) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }
    if (draft.selected_images.length === 0) {
      return NextResponse.json(errorResponse('草稿暂无图片可下载'), { status: 400 });
    }

    const usedNames = new Set<string>();
    const imageEntries = await Promise.all(
      draft.selected_images.map((image, index) => fetchImageEntry(image, index, usedNames)),
    );
    const manifestEntry: StoredZipEntry = {
      name: 'manifest.json',
      data: Buffer.from(JSON.stringify(createManifest(draft), null, 2), 'utf8'),
    };
    const zipBuffer = createStoredZip([...imageEntries, manifestEntry]);
    const fileName = `${sanitizeFileName(draft.title || `draft-${draft.id}`, `draft-${draft.id}`)}-images.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': encodeContentDispositionFileName(fileName),
        'Content-Length': String(zipBuffer.length),
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('下载草稿图片包失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '下载草稿图片包失败'),
      { status: 500 },
    );
  }
}
