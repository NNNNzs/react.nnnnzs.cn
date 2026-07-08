/**
 * AI 场景绑定服务
 * 每条绑定 = 某场景选用某 provider 的某模型 + 场景专属参数。
 * 每场景仅 1 条 is_active=true，由 activate 事务保证。
 */

import { getPrisma } from '@/lib/prisma';

export interface AiBindingInput {
  scenario: string;
  provider_id: number;
  model: string;
  name?: string;
  remark?: string;
  temperature?: number | null;
  max_tokens?: number | null;
  dimensions?: number | null;
  api_mode?: string | null;
  voice?: string | null;
  is_active?: boolean;
}

export interface AiBindingWithProvider {
  id: number;
  scenario: string;
  provider_id: number;
  model: string;
  name: string | null;
  remark: string | null;
  temperature: number | null;
  max_tokens: number | null;
  dimensions: number | null;
  api_mode: string | null;
  voice: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  provider: {
    id: number;
    name: string;
    base_url: string;
    api_key: string;
  };
}

function toBindingWithProvider(b: {
  id: number;
  scenario: string;
  provider_id: number;
  model: string;
  name: string | null;
  remark: string | null;
  temperature: number | null;
  max_tokens: number | null;
  dimensions: number | null;
  api_mode: string | null;
  voice: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  provider: { id: number; name: string; base_url: string; api_key: string };
}): AiBindingWithProvider {
  return { ...b };
}

const PROVIDER_SELECT = {
  id: true,
  name: true,
  base_url: true,
  api_key: true,
} as const;

/** 列出全部绑定（带 provider），按 scenario 分组返回 */
export async function listBindingsGrouped(): Promise<Record<string, AiBindingWithProvider[]>> {
  const prisma = await getPrisma();
  const bindings = await prisma.tbAiScenarioBinding.findMany({
    orderBy: [{ scenario: 'asc' }, { is_active: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      scenario: true,
      provider_id: true,
      model: true,
      name: true,
      remark: true,
      temperature: true,
      max_tokens: true,
      dimensions: true,
      api_mode: true,
      voice: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      provider: { select: PROVIDER_SELECT },
    },
  });

  const grouped: Record<string, AiBindingWithProvider[]> = {};
  for (const b of bindings) {
    (grouped[b.scenario] ??= []).push(toBindingWithProvider(b));
  }
  return grouped;
}

/** 列出指定场景的全部绑定（候选） */
export async function listBindingsByScenario(scenario: string): Promise<AiBindingWithProvider[]> {
  const prisma = await getPrisma();
  const bindings = await prisma.tbAiScenarioBinding.findMany({
    where: { scenario },
    orderBy: [{ is_active: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      scenario: true,
      provider_id: true,
      model: true,
      name: true,
      remark: true,
      temperature: true,
      max_tokens: true,
      dimensions: true,
      api_mode: true,
      voice: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      provider: { select: PROVIDER_SELECT },
    },
  });
  return bindings.map(toBindingWithProvider);
}

/** 获取某场景的激活绑定（带 provider），供 getAIConfig 使用 */
export async function getActiveBinding(scenario: string): Promise<AiBindingWithProvider | null> {
  const prisma = await getPrisma();
  const binding = await prisma.tbAiScenarioBinding.findFirst({
    where: { scenario, is_active: true },
    select: {
      id: true,
      scenario: true,
      provider_id: true,
      model: true,
      name: true,
      remark: true,
      temperature: true,
      max_tokens: true,
      dimensions: true,
      api_mode: true,
      voice: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      provider: { select: PROVIDER_SELECT },
    },
  });
  return binding ? toBindingWithProvider(binding) : null;
}

export async function createBinding(input: AiBindingInput): Promise<AiBindingWithProvider> {
  if (!input.provider_id || !input.model?.trim()) {
    throw new Error('provider_id 和 model 必填');
  }

  const prisma = await getPrisma();
  const now = new Date();

  // 若新建即激活，先重置同场景其它 active
  if (input.is_active) {
    await prisma.tbAiScenarioBinding.updateMany({
      where: { scenario: input.scenario, is_active: true },
      data: { is_active: false, updated_at: now },
    });
  }

  const created = await prisma.tbAiScenarioBinding.create({
    data: {
      scenario: input.scenario,
      provider_id: input.provider_id,
      model: input.model.trim(),
      name: input.name?.trim() || null,
      remark: input.remark?.trim() || null,
      temperature: input.temperature ?? null,
      max_tokens: input.max_tokens ?? null,
      dimensions: input.dimensions ?? null,
      api_mode: input.api_mode ?? null,
      voice: input.voice ?? null,
      is_active: input.is_active ?? false,
      created_at: now,
      updated_at: now,
    },
    select: {
      id: true,
      scenario: true,
      provider_id: true,
      model: true,
      name: true,
      remark: true,
      temperature: true,
      max_tokens: true,
      dimensions: true,
      api_mode: true,
      voice: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      provider: { select: PROVIDER_SELECT },
    },
  });
  return toBindingWithProvider(created);
}

export async function updateBinding(id: number, input: Partial<AiBindingInput>): Promise<AiBindingWithProvider> {
  const prisma = await getPrisma();
  const existing = await prisma.tbAiScenarioBinding.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('场景绑定不存在');
  }

  const data: Record<string, unknown> = { updated_at: new Date() };
  if (input.provider_id !== undefined) data.provider_id = input.provider_id;
  if (input.model !== undefined) data.model = input.model.trim();
  if (input.name !== undefined) data.name = input.name?.trim() || null;
  if (input.remark !== undefined) data.remark = input.remark?.trim() || null;
  if (input.temperature !== undefined) data.temperature = input.temperature;
  if (input.max_tokens !== undefined) data.max_tokens = input.max_tokens;
  if (input.dimensions !== undefined) data.dimensions = input.dimensions;
  if (input.api_mode !== undefined) data.api_mode = input.api_mode;
  if (input.voice !== undefined) data.voice = input.voice;

  const updated = await prisma.tbAiScenarioBinding.update({
    where: { id },
    data,
    select: {
      id: true,
      scenario: true,
      provider_id: true,
      model: true,
      name: true,
      remark: true,
      temperature: true,
      max_tokens: true,
      dimensions: true,
      api_mode: true,
      voice: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      provider: { select: PROVIDER_SELECT },
    },
  });
  return toBindingWithProvider(updated);
}

/**
 * 激活某绑定：事务内先把同场景其它记录置 false，再把目标置 true。
 */
export async function activateBinding(id: number): Promise<AiBindingWithProvider> {
  const prisma = await getPrisma();
  const target = await prisma.tbAiScenarioBinding.findUnique({ where: { id } });
  if (!target) {
    throw new Error('场景绑定不存在');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.tbAiScenarioBinding.updateMany({
      where: { scenario: target.scenario, is_active: true, id: { not: id } },
      data: { is_active: false, updated_at: now },
    }),
    prisma.tbAiScenarioBinding.update({
      where: { id },
      data: { is_active: true, updated_at: now },
    }),
  ]);

  const refreshed = await prisma.tbAiScenarioBinding.findUnique({
    where: { id },
    select: {
      id: true,
      scenario: true,
      provider_id: true,
      model: true,
      name: true,
      remark: true,
      temperature: true,
      max_tokens: true,
      dimensions: true,
      api_mode: true,
      voice: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      provider: { select: PROVIDER_SELECT },
    },
  });
  if (!refreshed) {
    throw new Error('场景绑定不存在');
  }
  return toBindingWithProvider(refreshed);
}

export async function deleteBinding(id: number): Promise<void> {
  const prisma = await getPrisma();
  await prisma.tbAiScenarioBinding.delete({ where: { id } });
}
