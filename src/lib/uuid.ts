/**
 * UUID 工具
 */
import { v4, validate } from 'uuid';

/** 匹配 UUID v1~v5 的正则 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 生成 UUID v4（uuid 包基于 Web Crypto，Node.js 与 Edge Runtime 均兼容）
 */
export function generateUuid(): string {
  return v4();
}

/**
 * 校验字符串是否为合法 UUID
 * @param value 待校验字符串
 */
export function isUuid(value: string): boolean {
  return validate(value);
}
