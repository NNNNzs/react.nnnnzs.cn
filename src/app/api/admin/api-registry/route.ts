/**
 * API 接口注册表管理 API
 * GET /api/admin/api-registry - 获取接口列表
 * PUT /api/admin/api-registry - 更新接口配置（MCP 开关等）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { USER_VIEW, USER_MANAGE } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { prisma } from '@/lib/prisma';
import type { ApiDescriptor } from '@/types/api-descriptor';

/** 获取接口列表接口描述 */
export const listDescriptor: ApiDescriptor = {
  code: 'api_registry_list',
  name: '接口注册表列表',
  module: 'admin',
  method: 'GET',
  permissionCode: USER_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      module: { type: 'string', description: '按模块筛选' },
      mcp_enabled: { type: 'string', description: '按 MCP 状态筛选：0-禁用，1-启用' },
      query: { type: 'string', description: '搜索关键词' },
      pageNum: { type: 'number', description: '页码' },
      pageSize: { type: 'number', description: '每页数量' },
    },
  },
};

/** 更新接口配置接口描述 */
export const updateDescriptor: ApiDescriptor = {
  code: 'api_registry_update',
  name: '更新接口配置',
  module: 'admin',
  method: 'PUT',
  permissionCode: USER_MANAGE,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: '接口ID' },
      mcp_enabled: { type: 'number', description: '是否启用 MCP：0-禁用，1-启用' },
      mcp_tool_name: { type: 'string', description: 'MCP 工具名' },
      permission_code: { type: 'string', description: '关联权限码' },
      status: { type: 'number', description: '状态：0-禁用，1-启用' },
    },
    required: ['id'],
  },
};

/**
 * 获取接口列表
 */
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageNum = Number(searchParams.get('pageNum')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 50;
    const moduleFilter = searchParams.get('module') || '';
    const mcpEnabled = searchParams.get('mcp_enabled');
    const query = searchParams.get('query') || '';

    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (moduleFilter) {
      where.module = moduleFilter;
    }
    if (mcpEnabled !== null && mcpEnabled !== undefined && mcpEnabled !== '') {
      where.mcp_enabled = parseInt(mcpEnabled, 10);
    }
    if (query) {
      where.OR = [
        { code: { contains: query } },
        { name: { contains: query } },
        { description: { contains: query } },
        { api_path: { contains: query } },
      ];
    }

    // 查询总数
    const total = await prisma.tbApiRegistry.count({ where });

    // 查询列表
    const apis = await prisma.tbApiRegistry.findMany({
      where,
      orderBy: [
        { module: 'asc' },
        { sort_order: 'asc' },
        { id: 'asc' },
      ],
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    });

    // 获取所有模块列表
    const modules = await prisma.tbApiRegistry.findMany({
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    });

    return NextResponse.json(
      successResponse({
        record: apis,
        total,
        pageNum,
        pageSize,
        modules: modules.map(m => m.module),
      })
    );
  } catch (error) {
    console.error('获取接口列表失败:', error);
    return NextResponse.json(errorResponse('获取接口列表失败'), { status: 500 });
  }
}

/**
 * 更新接口配置
 */
export async function PUT(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(errorResponse('缺少接口 ID'), { status: 400 });
    }

    // 检查接口是否存在
    const existing = await prisma.tbApiRegistry.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(errorResponse('接口不存在'), { status: 404 });
    }

    // 禁止启用没有 handler 的接口 MCP
    if (updateData.mcp_enabled === 1 && existing.mcp_available === 0) {
      return NextResponse.json(errorResponse('该接口未实现 MCP handler，无法启用'), { status: 400 });
    }

    // 更新接口配置
    const updated = await prisma.tbApiRegistry.update({
      where: { id },
      data: {
        ...(updateData.mcp_enabled !== undefined && { mcp_enabled: updateData.mcp_enabled }),
        ...(updateData.mcp_tool_name !== undefined && { mcp_tool_name: updateData.mcp_tool_name }),
        ...(updateData.permission_code !== undefined && { permission_code: updateData.permission_code }),
        ...(updateData.status !== undefined && { status: updateData.status }),
      },
    });

    return NextResponse.json(successResponse(updated, '更新成功'));
  } catch (error) {
    console.error('更新接口配置失败:', error);
    return NextResponse.json(errorResponse('更新接口配置失败'), { status: 500 });
  }
}
