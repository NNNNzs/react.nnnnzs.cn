/**
 * IP 地址获取工具
 * 支持多种代理和 CDN 环境下的真实 IP 获取
 */

import type { NextRequest } from 'next/server';

/**
 * 验证 IP 地址格式
 */
function isValidIp(ip: string): boolean {
  // IPv4 正则（简化版）
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 正则（简化版）
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * 获取客户端真实 IP 地址
 * 依次检查以下头部：
 * 1. x-forwarded-for（代理服务器）
 * 2. x-real-ip（Nginx 等）
 * 3. cf-connecting-ip（Cloudflare）
 *
 * 注意：
 * - 开发环境：无法获取 IP 时返回固定值并记录警告
 * - 生产环境：无法获取 IP 时抛出错误
 */
export function getClientIp(request: NextRequest): string {
  const isDev = process.env.NODE_ENV === 'development';

  // 1. 检查 x-forwarded-for（代理服务器）
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // 取第一个 IP（原始客户端 IP）
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp && isValidIp(firstIp)) {
      return firstIp;
    }
  }

  // 2. 检查 x-real-ip（Nginx 等）
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp && isValidIp(xRealIp)) {
    return xRealIp;
  }

  // 3. 检查 cf-connecting-ip（Cloudflare）
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp && isValidIp(cfConnectingIp)) {
    return cfConnectingIp;
  }

  // 4. 无法获取真实 IP 时的处理
  if (isDev) {
    // 开发环境：返回固定值并记录警告
    console.warn('⚠️ 无法获取客户端 IP，使用开发环境固定值。生产环境请确保配置正确的代理头部。');
    return '127.0.0.1';
  }

  // 生产环境：抛出错误
  throw new Error('无法获取客户端真实 IP 地址，请检查代理服务器配置（x-forwarded-for、x-real-ip 或 cf-connecting-ip）');
}
