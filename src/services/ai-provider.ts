/**
 * AI 供应商（Provider）服务
 * 维护 base_url + api_key + 可用模型清单，供场景绑定复用。
 */

import { getPrisma } from '@/lib/prisma';

export interface AiProviderInput {
  name: string;
  base_url: string;
  api_key: string;
  models?: string[];
  status?: number;
  remark?: string;
}

export interface FetchModelsResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

/** 规范化模型清单：去空白、去重 */
export function normalizeModels(models: unknown): string[] {
  if (!Array.isArray(models)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of models) {
    if (typeof m !== 'string') continue;
    const trimmed = m.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export async function listProviders() {
  const prisma = await getPrisma();
  const providers = await prisma.tbAiProvider.findMany({
    orderBy: [{ status: 'desc' }, { id: 'asc' }],
    include: { _count: { select: { bindings: true } } },
  });
  return providers.map((p) => ({
    ...p,
    models: normalizeModels(p.models),
    bindingCount: p._count.bindings,
  }));
}

export async function getProvider(id: number) {
  const prisma = await getPrisma();
  const provider = await prisma.tbAiProvider.findUnique({ where: { id } });
  if (!provider) return null;
  return { ...provider, models: normalizeModels(provider.models) };
}

export async function createProvider(input: AiProviderInput) {
  const prisma = await getPrisma();
  const now = new Date();
  return prisma.tbAiProvider.create({
    data: {
      name: input.name.trim(),
      base_url: input.base_url.trim(),
      api_key: input.api_key.trim(),
      models: normalizeModels(input.models),
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
  if (input.models !== undefined) data.models = normalizeModels(input.models);
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
 * 从供应商的 base_url + /models 拉取可用模型清单（仅支持 OpenAI 兼容协议）。
 * 拉取失败时返回 ok:false，由前端降级为手填。
 */
export async function fetchProviderModels(id: number): Promise<FetchModelsResult> {
  const provider = await getProvider(id);
  if (!provider) {
    return { ok: false, error: '供应商不存在' };
  }

  const baseUrl = provider.base_url.replace(/\/+$/, '');
  const url = `${baseUrl}/models`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${provider.api_key}`,
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return { ok: false, error: `上游返回 ${resp.status}` };
    }

    const json: unknown = await resp.json();
    const data = (json as { data?: unknown })?.data;
    const models = normalizeModels(Array.isArray(data) ? data.map((m) => (m as { id?: string })?.id) : []);
    if (models.length === 0) {
      return { ok: false, error: '响应中未解析到模型' };
    }

    // 拉取成功则回填到 provider.models
    await updateProvider(id, { models });
    return { ok: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
