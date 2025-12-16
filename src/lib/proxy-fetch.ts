/**
 * 服务端代理请求工具
 * 仅在 Node.js Runtime 下使用，用于通过 HTTP(S) 代理访问外部接口（如 GitHub）
 */

import type { Dispatcher } from 'undici';
import { ProxyAgent } from 'undici';

let proxyDispatcher: Dispatcher | null = null;

/**
 * 获取全局 Proxy Dispatcher
 *
 * 优先使用专门的 GitHub 代理环境变量，其次回退到通用的 HTTP(S) 代理。
 *
 * 支持的环境变量（按优先级）：
 * - GITHUB_PROXY_URL: 专门用于 GitHub 的代理，例如：http://127.0.0.1:7890
 * - HTTPS_PROXY / HTTP_PROXY: 通用代理配置
 */
function getProxyDispatcher(): Dispatcher | null {
  if (proxyDispatcher !== null) return proxyDispatcher;

  const proxyUrl =
    process.env.GITHUB_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY;

  if (!proxyUrl) {
    proxyDispatcher = null;
    return proxyDispatcher;
  }

  proxyDispatcher = new ProxyAgent(proxyUrl);
  return proxyDispatcher;
}

/**
 * 使用代理的服务端 fetch
 *
 * - 如果未配置任何代理环境变量，则回退为默认 fetch
 * - 仅在服务端（Node.js Runtime）中使用，避免在 Edge/浏览器环境中引用
 *
 * @param input 请求地址
 * @param init 请求配置
 * @returns fetch Response
 */
export async function proxyFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const dispatcher = getProxyDispatcher();

  if (!dispatcher) {
    // 未配置代理时，直接使用默认 fetch
    return fetch(input, init);
  }

  return fetch(input, {
    ...init,
    // Node/undici 的 fetch 支持 dispatcher 参数，这里为了兼容 TypeScript 类型做断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatcher: dispatcher as any,
  } as RequestInit);
}


