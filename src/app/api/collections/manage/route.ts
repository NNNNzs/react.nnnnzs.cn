import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { COLLECTION_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { getCollectionList } from '@/services/collection';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = {
  code: 'collection_manage_list',
  name: '合集管理列表',
  module: 'collection',
  method: 'GET',
  permissionCode: COLLECTION_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码' },
      pageSize: { type: 'number', description: '每页数量' },
      query: { type: 'string', description: '搜索关键词' },
      status: { type: 'string', description: '状态筛选：0、1 或 all' },
    },
  },
};

const querySchema = z.object({
  pageNum: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().max(255).default(''),
  status: z.enum(['0', '1', 'all']).default('all'),
});

/** 返回受权限保护的后台合集列表。 */
export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, COLLECTION_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!validation.success) {
      const message = validation.error.issues.map((issue) => issue.message).join('; ');
      return NextResponse.json(errorResponse(`输入验证失败: ${message}`), { status: 400 });
    }

    const { pageNum, pageSize, query, status } = validation.data;
    const result = await getCollectionList({
      pageNum,
      pageSize,
      query,
      ...(status === 'all' ? {} : { status: Number.parseInt(status, 10) }),
    });

    return NextResponse.json(successResponse(result), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('获取合集管理列表失败:', error);
    return NextResponse.json(errorResponse('获取合集管理列表失败'), { status: 500 });
  }
}
