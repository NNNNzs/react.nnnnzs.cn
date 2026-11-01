import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const CURRENT_URI = 'viking://resources/persona/current.json';
const PROFILE_ROOT = 'viking://resources/persona/profile/';
const MAX_CONTENT_LENGTH = 8_000;
const REQUEST_TIMEOUT_MS = 8_000;

type PersonaManifest = {
  profile?: unknown;
};

class OpenVikingHttpError extends Error {
  constructor(readonly status: number) {
    super(`OpenViking 请求失败（HTTP ${status}）`);
  }
}

function getConfig() {
  const baseUrl = process.env.OPENVIKING_PROFILE_URL?.trim();
  const apiKey = process.env.OPENVIKING_PROFILE_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;

  return {
    baseUrl: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    apiKey,
  };
}

function apiUrl(baseUrl: string, path: string): URL {
  return new URL(path, baseUrl);
}

async function requestJson(url: URL, apiKey: string) {
  const response = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) throw new OpenVikingHttpError(response.status);
  return response.json() as Promise<Record<string, unknown>>;
}

function getRequestErrorMessage(error: unknown): string {
  if (error instanceof OpenVikingHttpError && error.status === 401) {
    return 'OpenViking 身份认证失败，请检查博客专用只读 API 密钥是否有效。';
  }
  if (error instanceof OpenVikingHttpError && error.status === 403) {
    return 'OpenViking 账号无权读取已发布资料，请检查公开资料读取权限。';
  }
  return 'OpenViking 公开资料暂时无法检索。';
}

function unwrapText(payload: Record<string, unknown>): string {
  let value: unknown = payload.result ?? payload;
  for (let depth = 0; depth < 3 && value && typeof value === 'object'; depth += 1) {
    const record = value as Record<string, unknown>;
    value = record.content ?? record.text ?? record.data ?? record.result;
  }
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

async function readResource(uri: string, baseUrl: string, apiKey: string): Promise<string> {
  const url = apiUrl(baseUrl, 'api/v1/content/read');
  url.searchParams.set('uri', uri);
  const payload = await requestJson(url, apiKey);
  return unwrapText(payload);
}

function isPublishedProfileUri(uri: unknown): uri is string {
  if (typeof uri !== 'string' || !uri.startsWith(PROFILE_ROOT)) return false;

  // A manifest may point to one JSON file directly under the published profile directory.
  // Restricting the filename to a single safe segment prevents traversal and sibling scopes.
  const filename = uri.slice(PROFILE_ROOT.length);
  return /^[A-Za-z0-9_-]+\.json$/.test(filename);
}

function parseManifest(content: string): PersonaManifest {
  const manifest: unknown = JSON.parse(content);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('OpenViking 公开资料清单格式无效。');
  }
  return manifest as PersonaManifest;
}

export const searchPublicProfileTool = tool(
  async ({ query }) => {
    const config = getConfig();
    if (!config) {
      return JSON.stringify({ success: false, error: 'OpenViking 公开资料检索尚未配置。' });
    }

    try {
      const manifestContent = await readResource(CURRENT_URI, config.baseUrl, config.apiKey);
      const manifest = parseManifest(manifestContent);
      if (!isPublishedProfileUri(manifest.profile)) {
        throw new Error('OpenViking 公开资料清单未指向允许的 profile 文件。');
      }

      const profileContent = await readResource(manifest.profile, config.baseUrl, config.apiKey);
      if (!profileContent) {
        return JSON.stringify({ success: true, query, results: [] });
      }

      return JSON.stringify({
        success: true,
        query,
        results: [{
          uri: manifest.profile,
          content: profileContent.slice(0, MAX_CONTENT_LENGTH),
        }],
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: getRequestErrorMessage(error) });
    }
  },
  {
    name: 'search_public_profile',
    description: '读取站长已发布的 OpenViking 人物资料：先读取固定入口 current.json，再读取其中 profile 字段指向的资料文件。feed 为空时按无近况处理。只能依据返回内容回答，不要补充猜测。',
    schema: z.object({
      query: z.string().min(1).describe('用户想了解的站长公开资料，例如“技术写作偏好”'),
      limit: z.number().int().min(1).max(5).optional().describe('兼容旧调用参数；读取当前发布资料时不使用该参数'),
    }),
  },
);
