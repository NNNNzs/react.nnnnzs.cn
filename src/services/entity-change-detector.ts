/**
 * 实体变更检测工具
 *
 * 负责检测实体的字段变更，生成变更记录列表
 */

import { EntityType, ValueType, FieldChange } from '@/types/entity-change';
import { getEntityFieldConfigs, type FieldConfig } from '@/config/entity-field-configs';

/**
 * 序列化值
 *
 * @param value - 需要序列化的值
 * @param config - 字段配置
 * @returns 序列化后的字符串
 */
function serializeValue(value: unknown, config: FieldConfig): string {
  if (value === null || value === undefined) {
    return '';
  }

  // 使用自定义序列化函数
  if (config.serialize) {
    return config.serialize(value);
  }

  // 根据值类型序列化
  switch (config.valueType) {
    case ValueType.ARRAY:
    case ValueType.OBJECT:
    case ValueType.DATE:
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

/**
 * 比较两个值是否相等
 *
 * @param oldValue - 旧值
 * @param newValue - 新值
 * @param config - 字段配置
 * @returns 是否相等
 */
function compareValues(
  oldValue: unknown,
  newValue: unknown,
  config: FieldConfig
): boolean {
  // 使用自定义比较函数
  if (config.compare) {
    return config.compare(oldValue, newValue);
  }

  // 根据值类型比较
  switch (config.valueType) {
    case ValueType.ARRAY:
      // 对数组排序后比较，忽略顺序差异
      const oldArr = JSON.stringify(
        Array.isArray(oldValue) ? [...oldValue].sort() : oldValue
      );
      const newArr = JSON.stringify(
        Array.isArray(newValue) ? [...newValue].sort() : newValue
      );
      return oldArr === newArr;

    case ValueType.OBJECT:
    case ValueType.DATE:
      // 深度比较对象
      return JSON.stringify(oldValue) === JSON.stringify(newValue);

    case ValueType.NUMBER:
      // 数字比较，处理 NaN 情况
      return oldValue === newValue ||
        (typeof oldValue === 'number' && typeof newValue === 'number' &&
         isNaN(oldValue) && isNaN(newValue));

    default:
      // 严格相等比较
      return oldValue === newValue;
  }
}

/**
 * 检测字段变更
 *
 * 比较旧数据和新数据，找出发生变化的字段
 *
 * @param entityType - 实体类型
 * @param oldData - 旧数据（完整对象）
 * @param newData - 新数据（部分或完整对象）
 * @returns 变更字段列表
 */
export function detectChanges(
  entityType: EntityType,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): FieldChange[] {
  const configs = getEntityFieldConfigs(entityType);
  const changes: FieldChange[] = [];

  // 遍历所有配置的字段
  for (const fieldName in configs) {
    const config = configs[fieldName];
    const dbFieldName = config.fieldName;

    // 只检查新数据中包含的字段（部分更新场景）
    // 如果新数据中没有该字段，跳过
    if (!(dbFieldName in newData)) {
      continue;
    }

    const oldValue = oldData[dbFieldName];
    const newValue = newData[dbFieldName];

    // 比较值是否相等
    const isEqual = compareValues(oldValue, newValue, config);

    // 如果不相等，记录变更
    if (!isEqual) {
      changes.push({
        fieldName: dbFieldName,
        displayName: config.displayName,
        oldValue,
        newValue,
        valueType: config.valueType,
      });
    }
  }

  return changes;
}

/**
 * 检测删除操作的变更
 *
 * 当实体被删除时，记录删除状态的变更
 *
 * @param entityType - 实体类型
 * @param deletedData - 被删除的数据
 * @returns 删除变更记录
 */
export function detectDeletionChanges(
  entityType: EntityType,
  deletedData: Record<string, unknown>
): FieldChange[] {
  return [
    {
      fieldName: 'is_delete',
      displayName: '删除状态',
      oldValue: false,
      newValue: true,
      valueType: ValueType.BOOLEAN,
    },
  ];
}

/**
 * 检测恢复操作的变更
 *
 * 当实体从删除状态恢复时，记录恢复状态的变更
 *
 * @param entityType - 实体类型
 * @returns 恢复变更记录
 */
export function detectRestorationChanges(
  entityType: EntityType
): FieldChange[] {
  return [
    {
      fieldName: 'is_delete',
      displayName: '删除状态',
      oldValue: true,
      newValue: false,
      valueType: ValueType.BOOLEAN,
    },
  ];
}
