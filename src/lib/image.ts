/**
 * 图片 URL 优化工具
 * 为腾讯云 CDN 图片添加压缩参数
 */

const CDN_PREFIX = "https://static.nnnnzs.cn";

/**
 * 图片优化类型
 */
export enum ImageOptimizationType {
  /** 文章列表封面 - 限宽 600px */
  POST_LIST_COVER = "post_list_cover",
  /** 文章卡片封面 - 限宽 400px */
  POST_CARD_COVER = "post_card_cover",
  /** 合集封面 - 限宽 600px */
  COLLECTION_COVER = "collection_cover",
  /** 小封面缩略图 - 限宽 200px */
  SMALL_THUMBNAIL = "small_thumbnail",
  /** 不进行优化 */
  NONE = "none",
}

const OPTIMIZATION_PARAMS: Record<ImageOptimizationType, string> = {
  [ImageOptimizationType.POST_LIST_COVER]: "imageMogr2/thumbnail/600x",
  [ImageOptimizationType.POST_CARD_COVER]: "imageMogr2/thumbnail/400x",
  [ImageOptimizationType.COLLECTION_COVER]: "imageMogr2/thumbnail/600x",
  [ImageOptimizationType.SMALL_THUMBNAIL]: "imageMogr2/thumbnail/200x",
  [ImageOptimizationType.NONE]: "",
};

/**
 * 优化图片 URL
 * 仅对指定 CDN 域名的图片添加腾讯云图片处理参数
 *
 * @param url 原始图片 URL
 * @param type 优化类型
 * @returns 优化后的 URL
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  type: ImageOptimizationType = ImageOptimizationType.NONE
): string {
  // 空值处理
  if (!url) {
    return "";
  }

  // 仅处理指定 CDN 域名的图片
  if (!url.startsWith(CDN_PREFIX)) {
    return url;
  }

  const params = OPTIMIZATION_PARAMS[type];
  if (!params) {
    return url;
  }

  // 避免重复添加参数
  if (url.includes("imageMogr2")) {
    return url;
  }

  // 添加优化参数
  return `${url}?${params}`;
}

