/**
 * AI 场景（Scenario）服务
 * 管理自定义场景定义，内置场景在 ai-scenarios.ts 中硬编码。
 */

import { getPrisma } from '@/lib/prisma';
import { AI_SCENARIOS, type AiScenarioMeta, type AiBindingField } from '@/lib/ai-scenarios';

export interface ScenarioInput {
  key: string;
  label: string;
  description?: string;
  optionalFields?: AiBindingField[];
}

/** 合并内置场景 + 数据库自定义场景 */
export async function getAllScenarios(): Promise<AiScenarioMeta[]> {
  const prisma = await getPrisma();
  const custom = await prisma.tbAiScenario.findMany({
    where: { status: 1 },
    orderBy: { id: 'asc' },
  });

  const builtinKeys = new Set(AI_SCENARIOS.map((s) => s.key));

  const customScenarios: AiScenarioMeta[] = custom
    .filter((s) => !builtinKeys.has(s.key)) // 防止内置 key 被覆盖
    .map((s) => ({
      key: s.key,
      label: s.label,
      description: s.description ?? '',
      optionalFields: Array.isArray(s.optionalFields) ? (s.optionalFields as AiBindingField[]) : [],
    }));

  return [...AI_SCENARIOS, ...customScenarios];
}

/** 创建自定义场景 */
export async function createScenario(input: ScenarioInput): Promise<{ id: number }> {
  if (!input.key || !input.label) {
    throw new Error('key 和 label 必填');
  }
  // 校验 key 格式
  if (!/^[a-z0-9_]+$/.test(input.key)) {
    throw new Error('key 仅允许小写字母、数字、下划线');
  }
  // 检查是否与内置 key冲突
  if (AI_SCENARIOS.some((s) => s.key === input.key)) {
    throw new Error(`场景 key "${input.key}" 与内置场景冲突`);
  }

  const prisma = await getPrisma();
  const existing = await prisma.tbAiScenario.findUnique({ where: { key: input.key } });
  if (existing) {
    throw new Error(`场景 key "${input.key}" 已存在`);
  }

  const created = await prisma.tbAiScenario.create({
    data: {
      key: input.key,
      label: input.label,
      description: input.description || null,
      optionalFields: input.optionalFields || [],
      is_builtin: false,
      status: 1,
    },
  });
  return { id: created.id };
}

/** 更新场景 */
export async function updateScenario(id: number, input: Partial<ScenarioInput>): Promise<void> {
  const prisma = await getPrisma();
  const existing = await prisma.tbAiScenario.findUnique({ where: { id } });
  if (!existing) throw new Error('场景不存在');
  if (existing.is_builtin) throw new Error('内置场景不允许修改');

  await prisma.tbAiScenario.update({
    where: { id },
    data: {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.optionalFields !== undefined && { optionalFields: input.optionalFields }),
    },
  });
}

/** 删除场景 */
export async function deleteScenario(id: number): Promise<void> {
  const prisma = await getPrisma();
  const existing = await prisma.tbAiScenario.findUnique({ where: { id } });
  if (!existing) throw new Error('场景不存在');
  if (existing.is_builtin) throw new Error('内置场景不允许删除');

  // 检查是否有绑定
  const bindingCount = await prisma.tbAiScenarioBinding.count({
    where: { scenario: existing.key },
  });
  if (bindingCount > 0) {
    throw new Error(`该场景下有 ${bindingCount} 条绑定，请先删除绑定`);
  }

  await prisma.tbAiScenario.delete({ where: { id } });
}
