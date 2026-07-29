import { z } from 'zod';

const optionalUrlSchema = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string().url('请输入有效的资源 URL').max(2048, '资源 URL 不能超过 2048 个字符').optional(),
);

const optionalTextSchema = (max: number, message: string) => z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string().max(max, message).optional(),
);

/** 单个昼夜主题的合集视觉配置。 */
export const collectionThemeVisualSchema = z.object({
  coverImageUrl: optionalUrlSchema,
  coverVideoUrl: optionalUrlSchema,
  backgroundImageUrl: optionalUrlSchema,
  objectPosition: optionalTextSchema(64, '焦点位置不能超过 64 个字符'),
  accentColor: z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().regex(/^#[0-9A-Fa-f]{6}$/, '主题色必须是六位十六进制颜色').optional(),
  ),
}).strict();

/** 合集版本化扩展配置。 */
export const collectionVisualConfigSchema = z.object({
  version: z.literal(1),
  presentation: z.object({
    day: collectionThemeVisualSchema,
    night: collectionThemeVisualSchema,
  }).strict(),
  readingPath: z.array(
    z.string().trim().min(1, '阅读线索不能为空').max(50, '单条阅读线索不能超过 50 个字符'),
  ).max(8, '阅读线索最多 8 条').optional(),
}).strict();

export type CollectionThemeVisual = z.infer<typeof collectionThemeVisualSchema>;
export type CollectionVisualConfig = z.infer<typeof collectionVisualConfigSchema>;
export type CollectionVisualTheme = keyof CollectionVisualConfig['presentation'];

export interface LegacyCollectionVisualFields {
  cover?: string | null;
  background?: string | null;
  color?: string | null;
  extends_json?: unknown;
}

export interface ResolvedCollectionVisual {
  coverImageUrl?: string;
  coverVideoUrl?: string;
  backgroundImageUrl?: string;
  objectPosition: string;
  accentColor: string;
}

/** 根据扩展名识别旧 background 字段中的视频资源。 */
export function isVideoResourceUrl(value: string | null | undefined): boolean {
  if (!value) return false;

  try {
    const pathname = new URL(value, 'https://local.invalid').pathname;
    return /\.(mp4|webm|ogg|mov)$/i.test(pathname);
  } catch {
    return /\.(mp4|webm|ogg|mov)(?:$|\?)/i.test(value);
  }
}

/** 返回后台表单可直接使用的空配置。 */
export function createEmptyCollectionVisualConfig(): CollectionVisualConfig {
  return {
    version: 1,
    presentation: {
      day: {},
      night: {},
    },
  };
}

/** 将 Ant Design Form 返回的部分嵌套值重建为可提交的版本化配置。 */
export function normalizeCollectionVisualConfigForSubmit(
  value: Partial<CollectionVisualConfig> | null | undefined,
): CollectionVisualConfig {
  return {
    version: 1,
    presentation: {
      day: value?.presentation?.day || {},
      night: value?.presentation?.night || {},
    },
    ...(value?.readingPath ? { readingPath: value.readingPath } : {}),
  };
}

/** 将数据库 JsonValue 收窄为可信的合集视觉配置。 */
export function parseCollectionVisualConfig(value: unknown): CollectionVisualConfig | null {
  const result = collectionVisualConfigSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * 将旧字段映射到日间视觉槽位，供后台表单展示和后续保存。
 * 旧 background 中的视频只作为竖长封面视频兼容源，不再作为页面背景播放。
 */
export function createCollectionVisualConfigWithLegacyFallback(
  collection: LegacyCollectionVisualFields,
): CollectionVisualConfig {
  const config = parseCollectionVisualConfig(collection.extends_json);

  // 一旦存在有效的新配置，就必须尊重其中的空值。否则用户显式清空资源后，
  // 旧字段会在下一次加载时再次把资源补回表单。
  if (config) return config;

  const emptyConfig = createEmptyCollectionVisualConfig();
  const legacyBackgroundVideo = isVideoResourceUrl(collection.background)
    ? collection.background || undefined
    : undefined;
  const legacyBackgroundImage = isVideoResourceUrl(collection.background)
    ? undefined
    : collection.background || undefined;

  return {
    ...emptyConfig,
    presentation: {
      day: {
        coverImageUrl: collection.cover || undefined,
        coverVideoUrl: legacyBackgroundVideo,
        backgroundImageUrl: legacyBackgroundImage,
        accentColor: collection.color || undefined,
      },
      night: {},
    },
  };
}

/**
 * 按当前主题解析资源。有效新配置存在时不再读取旧字段，
 * 且封面视频严格使用当前主题配置，以便显式清空能够生效。
 */
export function resolveCollectionVisual(
  collection: LegacyCollectionVisualFields,
  theme: CollectionVisualTheme,
): ResolvedCollectionVisual {
  const config = parseCollectionVisualConfig(collection.extends_json);
  const current = config?.presentation[theme];
  const fallback = config?.presentation[theme === 'day' ? 'night' : 'day'];
  const legacyBackgroundImage = !config && !isVideoResourceUrl(collection.background)
    ? collection.background || undefined
    : undefined;
  const legacyBackgroundVideo = !config && isVideoResourceUrl(collection.background)
    ? collection.background || undefined
    : undefined;
  const legacyCoverImage = !config
    ? collection.cover || undefined
    : undefined;

  return {
    coverImageUrl: current?.coverImageUrl || fallback?.coverImageUrl || legacyCoverImage,
    coverVideoUrl:
      current?.coverVideoUrl || (!config && theme === 'day' ? legacyBackgroundVideo : undefined),
    backgroundImageUrl:
      current?.backgroundImageUrl || fallback?.backgroundImageUrl || legacyBackgroundImage
      || legacyCoverImage,
    objectPosition: current?.objectPosition || fallback?.objectPosition || '50% 50%',
    accentColor:
      current?.accentColor || fallback?.accentColor
      || (!config ? collection.color || undefined : undefined) || '#7a8c98',
  };
}

/** 返回某个主题已配置的资源数量，供后台完整度展示。 */
export function getCollectionVisualCompleteness(
  collection: LegacyCollectionVisualFields,
  theme: CollectionVisualTheme,
): { configured: number; total: number } {
  const config = parseCollectionVisualConfig(collection.extends_json);
  const visual = config?.presentation[theme];
  const values = [
    visual?.coverImageUrl,
    visual?.coverVideoUrl,
    visual?.backgroundImageUrl,
  ];

  return {
    configured: values.filter(Boolean).length,
    total: values.length,
  };
}
