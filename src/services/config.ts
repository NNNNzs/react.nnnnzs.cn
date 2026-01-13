/**
 * 配置服务
 * 提供配置的增删改查功能
 */

import { getPrisma } from '@/lib/prisma';
import type { QueryConfigCondition, PageQueryRes, CreateConfigDto, UpdateConfigDto } from '@/dto/config.dto';
import { TbConfig } from '@/generated/prisma-client';

/**
 * 获取配置列表
 */
export async function getConfigList(params: QueryConfigCondition): Promise<PageQueryRes<TbConfig>> {
  const { pageNum = 1, pageSize = 10, query = '', status } = params;

  const prisma = await getPrisma();

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  if (query) {
    whereConditions.title = { contains: query };
  }

  if (status !== undefined) {
    whereConditions.status = status;
  }

  // 查询数据
  const [data, count] = await Promise.all([
    prisma.tbConfig.findMany({
      where: whereConditions,
      orderBy: {
        id: 'desc',
      },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
    }),
    prisma.tbConfig.count({ where: whereConditions }),
  ]);

  return {
    record: data,
    total: count,
    pageNum,
    pageSize,
  };
}

/**
 * 根据 ID 获取配置
 */
export async function getConfigById(id: number, updateReadTime = false): Promise<TbConfig | null> {
  const prisma = await getPrisma();
  const config = await prisma.tbConfig.findUnique({
    where: { id },
  });

  // 如果需要更新读取时间
  if (config && updateReadTime) {
    const updated = await prisma.tbConfig.update({
      where: { id },
      data: {
        last_read_at: new Date(),
      },
    });
    return updated;
  }

  return config;
}

/**
 * 根据 key 获取配置
 */
export async function getConfigByKey(key: string): Promise<TbConfig | null> {
  const prisma = await getPrisma();
  return await prisma.tbConfig.findFirst({
    where: { key },
  });
}
export async function configByKeys(keys: string[]): Promise<Record<string, TbConfig>> {
  const prisma = await getPrisma();
  const configs = await prisma.tbConfig.findMany({
    where: {
      key: { in: keys },
    },
  });
  return configs.reduce((acc, config) => {
    if (config) {
      acc[config.key as string] = config;
    }
    return acc;
  }, {} as Record<string, TbConfig>);
}

/**
 * 创建配置
 */
export async function createConfig(dto: CreateConfigDto): Promise<TbConfig> {
  const prisma = await getPrisma();

  // 检查 key 是否已存在
  if (dto.key) {
    const existing = await prisma.tbConfig.findFirst({
      where: { key: dto.key },
    });
    if (existing) {
      throw new Error('配置 key 已存在');
    }
  }

  const now = new Date();
  const config = await prisma.tbConfig.create({
    data: {
      ...dto,
      created_at: now,
      updated_at: now,
    },
  });
  return config;
}

/**
 * 更新配置
 */
export async function updateConfig(id: number, dto: UpdateConfigDto): Promise<TbConfig> {
  const prisma = await getPrisma();

  // 检查配置是否存在
  const config = await prisma.tbConfig.findUnique({
    where: { id },
  });

  if (!config) {
    throw new Error('配置不存在');
  }

  // 如果更新 key，检查新 key 是否已存在
  if (dto.key && dto.key !== config.key) {
    const existing = await prisma.tbConfig.findFirst({
      where: { key: dto.key },
    });
    if (existing) {
      throw new Error('配置 key 已存在');
    }
  }

  // 自动更新 updated_at
  const updated = await prisma.tbConfig.update({
    where: { id },
    data: {
      ...dto,
      updated_at: new Date(),
    },
  });

  return updated;
}

/**
 * 删除配置
 */
export async function deleteConfig(id: number): Promise<void> {
  const prisma = await getPrisma();

  const config = await prisma.tbConfig.findUnique({
    where: { id },
  });

  if (!config) {
    throw new Error('配置不存在');
  }

  await prisma.tbConfig.delete({
    where: { id },
  });
}
