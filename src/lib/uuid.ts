/**
 * UUID 校验工具
 */

/** 匹配 UUID v1~v5 的正则 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 校验字符串是否为合法 UUID
 * @param value 待校验字符串
 */
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}
