export const DRAFT_PLATFORM_PROFILES = {
  xhs: {
    platform: 'xhs',
    type: 'note',
    label: '小红书图文笔记',
    editor: 'note',
  },
  zhihu: {
    platform: 'zhihu',
    type: 'article',
    label: '知乎长文',
    editor: 'markdown',
  },
} as const;

export type DraftPlatform = keyof typeof DRAFT_PLATFORM_PROFILES;
export type DraftPlatformProfile = typeof DRAFT_PLATFORM_PROFILES[DraftPlatform];

export const DRAFT_PLATFORMS = Object.keys(DRAFT_PLATFORM_PROFILES) as DraftPlatform[];

export function getDraftPlatformProfile(platform: string): DraftPlatformProfile | undefined {
  return DRAFT_PLATFORM_PROFILES[platform as DraftPlatform];
}
