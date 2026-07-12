import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_VIEW, CONTENT_CREATE } from '@/constants/permissions';
import type { ApiDescriptor } from '@/types/api-descriptor';
import {
  CONTENT_TOPIC_SOURCE_TYPES,
  CONTENT_TOPIC_STATUSES,
  createContentTopic,
  listContentTopics,
} from '@/services/content-creation';
import {
  getNumberParam,
  getStringParam,
  validationErrorResponse,
} from '../_utils';

/** 新建选题 API / MCP 工具的唯一元数据定义。 */
export const descriptor: ApiDescriptor = {
  // 复用数据库中已存在的 POST /api/create/topics 注册项，避免同一路由重复登记。
  code: 'create_topics_create',
  name: '新建选题',
  description: '在内容创作中台创建一个选题。选题只保存创作意图、来源和核心角度，不包含平台草稿正文。创建前会按标题和来源检查重复。',
  module: 'content',
  method: 'POST',
  permissionCode: CONTENT_CREATE,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '选题标题' },
      source_type: { type: 'string', description: '来源类型：idea、blog、url 或 website；不传时根据来源自动推断' },
      source_url: { type: 'string', description: '文章或网站来源 URL' },
      source_post_id: { type: 'number', description: '来源博客文章 ID' },
      original_idea: { type: 'string', description: '保留的原始创作想法' },
      core_angle: { type: 'string', description: '后续草稿应采用的核心角度' },
      key_points: { type: 'array', items: { type: 'string' }, description: '后续草稿应覆盖的关键点列表' },
      status: { type: 'string', description: '选题状态：IDEA、USED 或 ARCHIVED，默认 IDEA' },
    },
    required: ['title'],
  },
};

export const createTopicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符'),
  source_type: z.enum(CONTENT_TOPIC_SOURCE_TYPES).optional(),
  source_url: z.string().url('请输入有效的来源链接').max(5000).optional().nullable().or(z.literal('')),
  original_idea: z.string().max(10000).optional().nullable(),
  core_angle: z.string().max(10000).optional().nullable(),
  key_points: z.array(z.string().min(1).max(1000)).max(30).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  pillar: z.string().max(80).optional().nullable(),
  series: z.string().max(80).optional().nullable(),
  status: z.enum(CONTENT_TOPIC_STATUSES).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  source_post_id: z.coerce.number().int().positive().optional().nullable(),
  source_note: z.string().max(5000).optional().nullable(),
  ai_reason: z.string().max(5000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const scopeAll = hasDataPermission(check.user, CONTENT_VIEW);
    const searchParams = request.nextUrl.searchParams;
    const result = await listContentTopics({
      pageNum: getNumberParam(searchParams.get('pageNum')),
      pageSize: getNumberParam(searchParams.get('pageSize')),
      query: getStringParam(searchParams.get('query')),
      status: getStringParam(searchParams.get('status')),
      sourcePostId: getNumberParam(searchParams.get('sourcePostId')),
      userId: scopeAll ? undefined : check.user.id,
    });

    return NextResponse.json(successResponse(result), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('获取内容选题失败:', error);
    return NextResponse.json(errorResponse('获取内容选题失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_CREATE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createTopicSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createContentTopic({
      ...validation.data,
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(result, '选题已创建'), { status: 201 });
  } catch (error) {
    console.error('创建内容选题失败:', error);
    const message = error instanceof Error ? error.message : '创建内容选题失败';
    const status = message.startsWith('相似选题已存在') ? 409 : 500;
    return NextResponse.json(errorResponse(message), { status });
  }
}
