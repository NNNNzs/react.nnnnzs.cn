import { NextRequest, NextResponse } from 'next/server';
import { POST_VIEW, POST_VIEW_DELETED } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { hasPermissionCode, requirePermission } from '@/lib/permission';
import { getPostSeoAuditPage } from '@/services/post-seo-audit';
import type { SeoQualityGrade } from '@/lib/seo-content';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const descriptor: ApiDescriptor = {
  code: 'post_seo_audit',
  name: '文章 SEO 内容审计',
  description: '只读计算文章质量等级、内容长度和 SEO 风险，不修改文章状态。',
  module: 'post',
  method: 'GET',
  permissionCode: POST_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码，默认 1' },
      pageSize: { type: 'number', description: '每页数量，默认 20，最大 100' },
      grade: { type: 'string', description: '质量等级：A、B 或 C' },
      seo_indexable: { type: 'boolean', description: 'SEO 收录状态过滤' },
      hide: { type: 'string', description: '公开状态过滤：0、1 或 all' },
    },
  },
};

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, POST_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageNum = Math.max(1, Number(searchParams.get('pageNum')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));
    const gradeParam = searchParams.get('grade');
    const hideParam = searchParams.get('hide') || '0';
    const seoIndexableParam = searchParams.get('seo_indexable');

    if (gradeParam && !['A', 'B', 'C'].includes(gradeParam)) {
      return NextResponse.json(errorResponse('grade 必须为 A、B 或 C'), { status: 400 });
    }
    if (!['0', '1', 'all'].includes(hideParam)) {
      return NextResponse.json(errorResponse('hide 必须为 0、1 或 all'), { status: 400 });
    }
    if (seoIndexableParam !== null && !['true', 'false'].includes(seoIndexableParam)) {
      return NextResponse.json(errorResponse('seo_indexable 必须为 true 或 false'), { status: 400 });
    }

    if (hideParam === 'all' && !hasPermissionCode(check.user, POST_VIEW_DELETED)) {
      return NextResponse.json(errorResponse('无权限查看全部文章审计结果'), { status: 403 });
    }

    const result = await getPostSeoAuditPage({
      pageNum,
      pageSize,
      grade: gradeParam as SeoQualityGrade | undefined,
      seoIndexable: parseBoolean(seoIndexableParam),
      hide: hideParam as '0' | '1' | 'all',
    });

    return NextResponse.json(successResponse(result), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('获取文章 SEO 审计失败:', error);
    return NextResponse.json(errorResponse('获取文章 SEO 审计失败'), { status: 500 });
  }
}
