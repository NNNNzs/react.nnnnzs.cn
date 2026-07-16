import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_VIEW, CONTENT_CREATE } from '@/constants/permissions';
import {
  CONTENT_DRAFT_STATUSES,
  CONTENT_DRAFT_TYPES,
  createContentDraft,
  listContentDrafts,
} from '@/services/content-creation';
import {
  getNumberParam,
  getStringParam,
  validationErrorResponse,
} from '../_utils';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const createDraftSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符'),
  platform: z.enum(['xhs', 'zhihu']).default('xhs'),
  type: z.enum(CONTENT_DRAFT_TYPES).default('note'),
  status: z.enum(CONTENT_DRAFT_STATUSES).default('DRAFT'),
  topic_id: z.coerce.number().int().positive().optional().nullable(),
  source_post_id: z.coerce.number().int().positive().optional().nullable(),
  template_id: z.coerce.number().int().positive().optional().nullable(),
  hook: z.string().max(5000).optional().nullable(),
  body: z.string().max(100000).optional().nullable(),
  tags: z.array(z.string().min(1)).max(20).optional().nullable(),
}).superRefine((value, context) => {
  if (value.platform === 'zhihu' && value.type !== 'article') {
    context.addIssue({
      code: 'custom',
      path: ['type'],
      message: '知乎草稿必须使用长文 / Markdown 类型',
    });
  }
});

export const getDescriptor: ApiDescriptor = {
  code: 'create_drafts_list',
  name: '草稿列表',
  description: '分页查询内容草稿，可按关键词、平台、类型、状态和选题筛选。',
  module: 'content',
  method: 'GET',
  permissionCode: CONTENT_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码，默认 1' },
      pageSize: { type: 'number', description: '每页数量，默认 20，最大 100' },
      query: { type: 'string', description: '搜索草稿标题、开头或正文' },
      platform: { type: 'string', description: '平台：xhs 或 zhihu' },
      type: { type: 'string', description: '草稿类型' },
      status: { type: 'string', description: '草稿状态' },
      topicId: { type: 'number', description: '关联选题 ID' },
    },
  },
};

export const createDescriptor: ApiDescriptor = {
  code: 'create_drafts_create',
  name: '新建草稿',
  description: '新建小红书或知乎草稿，可直接写入标题、开头、正文和标签。',
  module: 'content',
  method: 'POST',
  permissionCode: CONTENT_CREATE,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '草稿标题' },
      platform: { type: 'string', description: '平台：xhs 或 zhihu，默认 xhs' },
      type: { type: 'string', description: '类型；知乎必须使用 article' },
      status: { type: 'string', description: '状态，默认 DRAFT' },
      topic_id: { type: 'number', description: '关联选题 ID' },
      source_post_id: { type: 'number', description: '来源博客文章 ID' },
      template_id: { type: 'number', description: '使用的模板 ID' },
      hook: { type: 'string', description: '开头或钩子文案' },
      body: { type: 'string', description: '平台正文；知乎可写 Markdown' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
    },
    required: ['title'],
  },
};

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const scopeAll = hasDataPermission(check.user, CONTENT_VIEW);
    const result = await listContentDrafts({
      pageNum: getNumberParam(searchParams.get('pageNum')),
      pageSize: getNumberParam(searchParams.get('pageSize')),
      query: getStringParam(searchParams.get('query')),
      status: getStringParam(searchParams.get('status')),
      platform: getStringParam(searchParams.get('platform')),
      type: getStringParam(searchParams.get('type')),
      topicId: getNumberParam(searchParams.get('topicId')),
      userId: scopeAll ? undefined : check.user.id,
    });

    return NextResponse.json(successResponse(result), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('获取内容草稿失败:', error);
    return NextResponse.json(errorResponse('获取内容草稿失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_CREATE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createDraftSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createContentDraft({
      ...validation.data,
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(result, '草稿已创建'), { status: 201 });
  } catch (error) {
    console.error('创建内容草稿失败:', error);
    return NextResponse.json(errorResponse('创建内容草稿失败'), { status: 500 });
  }
}
