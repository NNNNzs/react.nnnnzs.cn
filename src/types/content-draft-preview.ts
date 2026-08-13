export const CONTENT_DRAFT_PREVIEW_MODES = ['xhs', 'zhihu', 'toutiao'] as const;

export type ContentDraftPreviewMode = typeof CONTENT_DRAFT_PREVIEW_MODES[number];

export interface PublicDraftPreviewImage {
  url: string;
  alt: string;
  sortOrder: number;
}

export interface PublicDraftPreviewDto {
  title: string;
  hook: string | null;
  summary: string;
  body: string;
  tags: string[];
  images: PublicDraftPreviewImage[];
  updatedAt: Date;
  author: {
    name: string;
  };
}
