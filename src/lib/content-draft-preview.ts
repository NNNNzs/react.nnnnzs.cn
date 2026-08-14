import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CONTENT_DRAFT_PREVIEW_MODES,
  type ContentDraftPreviewMode,
  type PublicDraftPreviewDto,
} from '@/types/content-draft-preview';

export const CONTENT_DRAFT_PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_SITE_URL = 'https://www.nnnnzs.cn';

type ContentDraftPreviewSignaturePayload = {
  draftId: number;
  expiresAt: number;
};

export function parseContentDraftPreviewMode(value: string | null | undefined): ContentDraftPreviewMode | null {
  return CONTENT_DRAFT_PREVIEW_MODES.includes(value as ContentDraftPreviewMode)
    ? value as ContentDraftPreviewMode
    : null;
}

function getPreviewSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 未配置，无法生成草稿预览链接');
  return secret;
}

export function assertContentDraftPreviewSigningConfigured(): void {
  getPreviewSecret();
}

function createSignature(payload: ContentDraftPreviewSignaturePayload): string {
  return createHmac('sha256', getPreviewSecret())
    .update(`${payload.draftId}.${payload.expiresAt}`)
    .digest('base64url');
}

export function createContentDraftPreviewUrl(draftId: number, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + CONTENT_DRAFT_PREVIEW_TTL_SECONDS;
  const signature = createSignature({ draftId, expiresAt });
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${siteUrl}/preview?draftId=${draftId}&expiresAt=${expiresAt}&signature=${encodeURIComponent(signature)}`;
}

export function withContentDraftPreviewUrl<T extends { id: number }>(draft: T): T & { previewUrl: string } {
  return { ...draft, previewUrl: createContentDraftPreviewUrl(draft.id) };
}

export function verifyContentDraftPreviewSignature(
  draftId: number,
  expiresAt: number,
  signature: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!Number.isInteger(draftId) || draftId <= 0 || !Number.isInteger(expiresAt) || expiresAt * 1000 <= now || !signature) return false;
  try {
    const expected = createSignature({ draftId, expiresAt });
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/** Only absolute HTTP(S) URLs are suitable for publicly rendered assets. */
export function getSafePublicImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Markdown may link to HTTP(S); mailto is allowed for links but never for images. */
export function getSafePublicMarkdownUrl(
  value: string,
  kind: 'link' | 'image',
): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    if (kind === 'link' && url.protocol === 'mailto:') return url.href;
  } catch {
    // Relative and malformed URLs are intentionally not rendered in public previews.
  }
  return '';
}

export function summarizeDraftPreview(hook: string | null, body: string | null): string {
  const source = hook?.trim() || body?.replace(/[#*_>`~-]/g, ' ').replace(/\s+/g, ' ').trim() || '';
  return source.slice(0, 220);
}

type PreviewDraftInput = {
  type: string;
  title: string;
  hook: string | null;
  body: string | null;
  tags_json: unknown;
  updated_at: Date;
  assets: Array<{
    sort_order: number;
    created_at: Date;
    asset: { type: string; title: string | null; cdn_url: string | null };
  }>;
};

/** Converts a deliberately small database projection into the only DTO public routes may render. */
export function toPublicDraftPreviewDto(draft: PreviewDraftInput): PublicDraftPreviewDto {
  const tags = Array.isArray(draft.tags_json)
    ? draft.tags_json.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
    : [];
  const images = draft.assets
    .map(({ sort_order, created_at, asset }) => ({
      sort_order,
      created_at,
      url: getSafePublicImageUrl(asset.cdn_url),
      alt: asset.title?.trim() || '草稿配图',
    }))
    .filter((asset): asset is typeof asset & { url: string } => Boolean(asset.url))
    .sort((left, right) => left.sort_order - right.sort_order || left.created_at.getTime() - right.created_at.getTime())
    .map(({ sort_order, url, alt }) => ({
      url,
      alt,
      sortOrder: sort_order,
    }));

  return {
    isMarkdown: draft.type === 'article',
    title: draft.title,
    hook: draft.hook?.trim() || null,
    summary: summarizeDraftPreview(draft.hook, draft.body),
    body: draft.body ?? '',
    tags,
    images,
    updatedAt: draft.updated_at,
    author: { name: 'NNNNzs' },
  };
}
