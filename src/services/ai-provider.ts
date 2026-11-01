/**
 * AI 供应商（Provider）服务
 * 维护 base_url + api_key + 可用模型清单，供场景绑定复用。
 */

import { getPrisma } from '@/lib/prisma';

export interface AiProviderInput {
  name: string;
  base_url: string;
  api_key: string;
  models?: unknown;
  status?: number;
  remark?: string;
}

export interface AiProviderModelConfig {
  id: string;
  isEmbeddingModel: boolean;
  sendDimensions: boolean;
  /** false 表示从旧版 string[] 模型清单转换而来，尚未由管理员确认属性。 */
  configured: boolean;
}

export interface FetchModelsResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

/** 规范化模型清单，兼容旧版 string[] 并读取新版 JSON 对象配置。 */
export function normalizeProviderModels(models: unknown): AiProviderModelConfig[] {
  if (!Array.isArray(models)) return [];
  const seen = new Set<string>();
  const result: AiProviderModelConfig[] = [];
  for (const m of models) {
    const record = m && typeof m === 'object' && !Array.isArray(m)
      ? m as Record<string, unknown>
      : null;
    const modelId = typeof m === 'string' ? m : record?.id;
    if (typeof modelId !== 'string') continue;
    const trimmed = modelId.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const configured = typeof record?.isEmbeddingModel === 'boolean'
      && typeof record.sendDimensions === 'boolean';
    result.push({
      id: trimmed,
      isEmbeddingModel: record?.isEmbeddingModel === true,
      // 旧配置维持原行为；只有管理员明确关闭时才省略 dimensions。
      sendDimensions: typeof record?.sendDimensions === 'boolean'
        ? record.sendDimensions
        : true,
      configured,
    });
  }
  return result;
}

/** 仅取模型名称，供 API 模型发现结果去重和兼容旧调用。 */
export function normalizeModelNames(models: unknown): string[] {
  return normalizeProviderModels(models).map((model) => model.id);
}

function serializeProviderModels(models: unknown) {
  return normalizeProviderModels(models).map(({ id, isEmbeddingModel, sendDimensions }) => ({
    id,
    isEmbeddingModel,
    sendDimensions,
  }));
}

export async function listProviders() {
  const prisma = await getPrisma();
  const providers = await prisma.tbAiProvider.findMany({
    orderBy: [{ status: 'desc' }, { id: 'asc' }],
    include: { _count: { select: { bindings: true } } },
  });
  return providers.map((p) => ({
    ...p,
    models: normalizeProviderModels(p.models),
    bindingCount: p._count.bindings,
  }));
}

export async function getProvider(id: number) {
  const prisma = await getPrisma();
  const provider = await prisma.tbAiProvider.findUnique({ where: { id } });
  if (!provider) return null;
  return { ...provider, models: normalizeProviderModels(provider.models) };
}

export async function createProvider(input: AiProviderInput) {
  const prisma = await getPrisma();
  const now = new Date();
  return prisma.tbAiProvider.create({
    data: {
      name: input.name.trim(),
      base_url: input.base_url.trim(),
      api_key: input.api_key.trim(),
      models: serializeProviderModels(input.models),
      status: input.status ?? 1,
      remark: input.remark,
      created_at: now,
      updated_at: now,
    },
  });
}

export async function updateProvider(id: number, input: Partial<AiProviderInput>) {
  const prisma = await getPrisma();
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.base_url !== undefined) data.base_url = input.base_url.trim();
  if (input.api_key !== undefined && input.api_key.trim()) {
    data.api_key = input.api_key.trim();
  }
  if (input.models !== undefined) data.models = serializeProviderModels(input.models);
  if (input.status !== undefined) data.status = input.status;
  if (input.remark !== undefined) data.remark = input.remark;

  return prisma.tbAiProvider.update({ where: { id }, data });
}

export async function deleteProvider(id: number): Promise<void> {
  const prisma = await getPrisma();
  // schema 上 binding 对 provider 是 onDelete: Cascade，删除会连带删除绑定
  await prisma.tbAiProvider.delete({ where: { id } });
}

/**
 * 从 OpenAI 兼容供应商拉取模型候选清单，不修改 Provider 配置。
 */
export async function fetchModelsFromProvider(
  baseUrlInput: string,
  apiKeyInput: string,
): Promise<FetchModelsResult> {
  const trimmedBaseUrl = baseUrlInput.trim().replace(/\/+$/, '');
  let baseUrl: URL;
  try {
    baseUrl = new URL(trimmedBaseUrl);
  } catch {
    return { ok: false, error: 'Base URL 格式无效' };
  }
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    return { ok: false, error: 'Base URL 仅支持 HTTP 或 HTTPS' };
  }

  const url = `${trimmedBaseUrl}/models`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let resp: Response;
    try {
      resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKeyInput.trim()}`,
          'Content-Type': 'application/json',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      return { ok: false, error: `上游返回 ${resp.status}` };
    }

    const json: unknown = await resp.json();
    const data = (json as { data?: unknown })?.data;
    const models = normalizeModelNames(Array.isArray(data) ? data.map((m) => (m as { id?: string })?.id) : []);
    if (models.length === 0) {
      return { ok: false, error: '响应中未解析到模型' };
    }

    return { ok: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** 从已保存的供应商拉取候选模型，不修改其模型清单。 */
export async function fetchProviderModels(id: number): Promise<FetchModelsResult> {
  const provider = await getProvider(id);
  if (!provider) {
    return { ok: false, error: '供应商不存在' };
  }
  return fetchModelsFromProvider(provider.base_url, provider.api_key);
}
