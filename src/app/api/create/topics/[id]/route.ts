import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_DELETE, CONTENT_EDIT, CONTENT_VIEW } from '@/constants/permissions';
import {
  CONTENT_TOPIC_SOURCE_TYPES,
  CONTENT_TOPIC_STATUSES,
  deleteContentTopic,
  getContentTopic,
  updateContentTopic,
} from '@/services/content-creation';
import { validationErrorResponse } from '../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateTopicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255).optional(),
  source_type: z.enum(CONTENT_TOPIC_SOURCE_TYPES).optional(),
  source_url: z.string().url('请输入有效的来源链接').max(5000).optional().nullable().or(z.literal('')),
  source_post_id: z.coerce.number().int().positive().optional().nullable(),
  original_idea: z.string().max(10000).optional().nullable(),
  core_angle: z.string().max(10000).optional().nullable(),
  key_points: z.array(z.string().min(1).max(1000)).max(30).optional().nullable(),
  status: z.enum(CONTENT_TOPIC_STATUSES).optional(),
});

async function readTopicId(context: RouteContext) {
  const { id } = await context.params;
  const topicId = Number(id);
  return Number.isInteger(topicId) && topicId > 0 ? topicId : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status });
    const topicId = await readTopicId(context);
    if (!topicId) return NextResponse.json(errorResponse('无效的选题 ID'), { status: 400 });
    const topic = await getContentTopic(topicId);
    if (!topic) return NextResponse.json(errorResponse('选题不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_VIEW, topic.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }
    return NextResponse.json(successResponse(topic), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('获取选题详情失败:', error);
    return NextResponse.json(errorResponse('获取选题详情失败'), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status });
    const topicId = await readTopicId(context);
    if (!topicId) return NextResponse.json(errorResponse('无效的选题 ID'), { status: 400 });
    const topic = await getContentTopic(topicId);
    if (!topic) return NextResponse.json(errorResponse('选题不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_EDIT, topic.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }
    const validation = updateTopicSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);
    const updated = await updateContentTopic(topicId, validation.data);
    return NextResponse.json(successResponse(updated, '选题已保存'));
  } catch (error) {
    console.error('更新选题失败:', error);
    const message = error instanceof Error ? error.message : '更新选题失败';
    return NextResponse.json(errorResponse(message), { status: message.startsWith('相似选题已存在') ? 409 : 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_DELETE);
    if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status });
    const topicId = await readTopicId(context);
    if (!topicId) return NextResponse.json(errorResponse('无效的选题 ID'), { status: 400 });
    const topic = await getContentTopic(topicId);
    if (!topic) return NextResponse.json(errorResponse('选题不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_DELETE, topic.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }
    await deleteContentTopic(topicId);
    return NextResponse.json(successResponse(null, '选题已删除'));
  } catch (error) {
    console.error('删除选题失败:', error);
    return NextResponse.json(errorResponse('删除选题失败'), { status: 500 });
  }
}
