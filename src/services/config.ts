/**
 * 配置服务
 * 提供配置的增删改查功能
 */

import { Like } from 'typeorm';
import { getConfigRepository } from '@/lib/repositories';
import type { QueryConfigCondition, PageQueryRes, CreateConfigDto, UpdateConfigDto } from '@/dto/config.dto';
import { TbConfig } from '@/entities/config.entity';

/**
 * 获取配置列表
 */
export async function getConfigList(params: QueryConfigCondition): Promise<PageQueryRes<TbConfig>> {
  const { pageNum = 1, pageSize = 10, query = '', status } = params;
  
  const configRepository = await getConfigRepository();

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  if (query) {
    whereConditions.title = Like(`%${query}%`);
  }

  if (status !== undefined) {
    whereConditions.status = status;
  }

  // 查询数据
  const [data, count] = await configRepository.findAndCount({
    where: whereConditions,
    order: {
      id: 'DESC',
    },
    take: pageSize,
    skip: (pageNum - 1) * pageSize,
  });

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
  const configRepository = await getConfigRepository();
  const config = await configRepository.findOne({
    where: { id },
  });
  
  // 如果需要更新读取时间
  if (config && updateReadTime) {
    await configRepository.update(id, {
      last_read_at: new Date(),
    });
    // 返回更新后的配置
    return await configRepository.findOne({
      where: { id },
    });
  }
  
  return config;
}

/**
 * 根据 key 获取配置
 */
export async function getConfigByKey(key: string): Promise<TbConfig | null> {
  const configRepository = await getConfigRepository();
  return await configRepository.findOne({
    where: { key },
  });
}

/**
 * 创建配置
 */
export async function createConfig(dto: CreateConfigDto): Promise<TbConfig> {
  const configRepository = await getConfigRepository();
  
  // 检查 key 是否已存在
  if (dto.key) {
    const existing = await configRepository.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new Error('配置 key 已存在');
    }
  }

  const now = new Date();
  const config = configRepository.create({
    ...dto,
    created_at: now,
    updated_at: now,
  });
  return await configRepository.save(config);
}

/**
 * 更新配置
 */
export async function updateConfig(id: number, dto: UpdateConfigDto): Promise<TbConfig> {
  const configRepository = await getConfigRepository();
  
  // 检查配置是否存在
  const config = await configRepository.findOne({
    where: { id },
  });

  if (!config) {
    throw new Error('配置不存在');
  }

  // 如果更新 key，检查新 key 是否已存在
  if (dto.key && dto.key !== config.key) {
    const existing = await configRepository.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new Error('配置 key 已存在');
    }
  }

  // 自动更新 updated_at
  await configRepository.update(id, {
    ...dto,
    updated_at: new Date(),
  });
  
  // 返回更新后的配置
  const updated = await configRepository.findOne({
    where: { id },
  });

  if (!updated) {
    throw new Error('更新失败');
  }

  return updated;
}

/**
 * 删除配置
 */
export async function deleteConfig(id: number): Promise<void> {
  const configRepository = await getConfigRepository();
  
  const config = await configRepository.findOne({
    where: { id },
  });

  if (!config) {
    throw new Error('配置不存在');
  }

  await configRepository.delete(id);
}
