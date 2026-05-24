export type ContentVariant = 'day' | 'night';

export type VariantContent<TContent> = Readonly<Record<ContentVariant, TContent>>;

export interface BannerContent {
  subtitle: string;
}

export interface AppContent {
  banner: BannerContent;
}

export const content: VariantContent<AppContent> = {
  day: {
    banner: {
      subtitle:
        'Neon Nomad Navigating Night Zones. 白天的房间留给阅读、整理和创作，代码、运维、AI 与生活切片在阳光里排成索引。',
    },
  },
  night: {
    banner: {
      subtitle:
        'Neon Nomad Navigating Night Zones. 代码、运维、AI、生活切片都收纳在这里，像深夜窗边一排还没有关掉的终端。',
    },
  },
};

export function getContent(variant: ContentVariant): AppContent {
  return content[variant];
}

export function getBannerSubtitle(variant: ContentVariant): string {
  return getContent(variant).banner.subtitle;
}
