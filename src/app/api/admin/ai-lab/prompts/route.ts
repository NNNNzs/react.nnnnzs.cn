import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AI_TEMPLATE_SCOPES,
  AI_TEMPLATE_STATUSES,
  AI_TEMPLATE_TYPES,
} from '@/constants/ai-template';
import { CONFIG_EDIT, CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import {
  createAiTemplate,
  listAiTemplates,
} from '@/services/ai-template';
import type { Prisma } from '@/generated/prisma-client/client';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

export const listDescriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_list',
  name: 'AI Lab Prompt 模板列表',
  description: '查询系统级 Prompt 模板 metadata 列表',
  module: 'ai_lab',
  method: 'GET',
  permissionCode: CONFIG_VIEW,
  inputSchema: {
    type: 'object',
    properties: {
      pageNum: { type: 'number', description: '页码' },
      pageSize: { type: 'number', description: '每页数量' },
      query: { type: 'string', description: '关键词' },
      type: { type: 'string', description: '模板类型' },
      scope: { type: 'string', description: '作用域' },
      status: { type: 'string', description: '状态' },
    },
  },
};

export const createDescriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_create',
  name: 'AI Lab Prompt 模板创建',
  description: '创建系统级 Prompt 模板及首个版本',
  module: 'ai_lab',
  method: 'POST',
  permissionCode: CONFIG_EDIT,
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: '模板唯一英文标识 slug，如 my-prompt-slug' },
      name: { type: 'string', description: '模板中文名称' },
      content: { type: 'string', description: '初始版本的 Markdown 提示词正文' },
      scope: { type: 'string', description: '作用域：system / content / chat 等，默认为 content' },
      description: { type: 'string', description: '模板用途说明' },
      aliases: {
        type: 'array',
        items: { type: 'string' },
        description: '别名列表',
      },
      metadata: {
        type: 'object',
        description: '模板元数据，如 { mcpExposed: true }',
      },
      changeNote: { type: 'string', description: '版本变更说明' },
      status: { type: 'string', description: '状态：ACTIVE 或 DRAFT，默认为 ACTIVE' },
    },
    required: ['slug', 'name', 'content'],
  },
};

export const createTemplateSchema = z.object({
  slug: z.string().min(1).max(120),
  key: z.string().max(120).optional().nullable(),
  name: z.string().min(1).max(200),
  type: z.enum(AI_TEMPLATE_TYPES).optional(),
  scope: z.enum(AI_TEMPLATE_SCOPES).optional(),
  description: z.string().max(2000).optional().nullable(),
  aliases: z.array(z.string().min(1).max(120)).optional(),
  metadata: z.unknown().optional().nullable(),
  content: z.string().min(1).max(300000),
  version: z.coerce.number().int().positive().optional(),
  changeNote: z.string().max(2000).optional().nullable(),
  status: z.enum(AI_TEMPLATE_STATUSES).optional(),
});

function jsonHeaders() {
  return {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  };
}

function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    errorResponse(`输入验证失败: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`),
    { status: 400 },
  );
}

function asInputJson(value: unknown) {
  return value as Prisma.InputJsonValue | null | undefined;
}

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { searchParams } = new URL(request.url);
    const result = await listAiTemplates({
      pageNum: Number(searchParams.get('pageNum')) || 1,
      pageSize: Number(searchParams.get('pageSize')) || 20,
      query: searchParams.get('query') || undefined,
      type: searchParams.get('type') || undefined,
      scope: searchParams.get('scope') || undefined,
      status: searchParams.get('status') || undefined,
    });

    return NextResponse.json(successResponse(result), { headers: jsonHeaders() });
  } catch (error) {
    console.error('查询 AI Prompt 模板失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询 AI Prompt 模板失败'),
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createTemplateSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createAiTemplate({
      ...validation.data,
      metadata: asInputJson(validation.data.metadata),
      createdBy: check.user.id,
    });

    return NextResponse.json(successResponse(result, '模板已创建'), {
      status: 201,
      headers: jsonHeaders(),
    });
  } catch (error) {
    console.error('创建 AI Prompt 模板失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建 AI Prompt 模板失败'),
      { status: 500 },
    );
  }
}
