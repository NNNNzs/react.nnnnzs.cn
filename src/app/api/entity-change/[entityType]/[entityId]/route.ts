/**
 * 实体变更历史查询 API
 *
 * GET /api/entity-change/:entityType/:entityId
 *
 * 查询特定实体的变更历史
 *
 * 路径参数：
 * - entityType: 实体类型（POST, COLLECTION）
 * - entityId: 实体ID
 *
 * 查询参数：
 * - limit: 返回数量限制（默认50）
 * - offset: 偏移量（默认0）
 * - fieldName: 字段名（可选，过滤特定字段）
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryEntityChangeLogs } from '@/services/entity-change-log';
import { EntityType } from '@/types/entity-change';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  try {
    const { entityType, entityId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const fieldName = searchParams.get('fieldName') || undefined;

    // 验证实体类型
    if (!Object.values(EntityType).includes(entityType as EntityType)) {
      return NextResponse.json(
        {
          error: '无效的实体类型',
          message: `支持的实体类型: ${Object.values(EntityType).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 验证实体ID
    const entityIdNum = parseInt(entityId);
    if (isNaN(entityIdNum)) {
      return NextResponse.json(
        { error: '无效的实体ID', message: 'entityId 必须是数字' },
        { status: 400 }
      );
    }

    // 查询变更日志
    const logs = await queryEntityChangeLogs({
      entityId: entityIdNum,
      entityType: entityType as EntityType,
      fieldName,
      limit,
      offset,
    });

    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        entityType,
        entityId: entityIdNum,
        total: logs.length,
        logs,
      },
    });
  } catch (error) {
    console.error('查询变更历史失败:', error);
    return NextResponse.json(
      {
        error: '查询失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
