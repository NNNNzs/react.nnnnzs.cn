import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_CREATE } from '@/constants/permissions';
import { createContentDraft, getContentTopic, updateContentTopic } from '@/services/content-creation';
import { validationErrorResponse } from '../../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const platformSchema = z.enum(['xhs', 'zhihu', 'douyin', 'blog']);
const createDraftFromTopicSchema = z.object({
  platform: platformSchema,
});

const platformDefaults = {
  xhs: { label: '小红书图文', type: 'note' },
  zhihu: { label: '知乎文章', type: 'article' },
  douyin: { label: '抖音短视频脚本', type: 'short_video' },
  blog: { label: '博客长文', type: 'article' },
} as const;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_CREATE);
    if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status });

    const { id } = await context.params;
    const topicId = Number(id);
    if (!Number.isInteger(topicId) || topicId <= 0) {
      return NextResponse.json(errorResponse('无效的选题 ID'), { status: 400 });
    }
    const topic = await getContentTopic(topicId);
    if (!topic) return NextResponse.json(errorResponse('选题不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_CREATE, topic.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }
    const validation = createDraftFromTopicSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const target = platformDefaults[validation.data.platform];
    const draft = await createContentDraft({
      topic_id: topic.id,
      source_post_id: topic.source_post_id,
      platform: validation.data.platform,
      type: target.type,
      title: topic.title,
      status: 'DRAFT',
      generation_snapshot_json: {
        topicSnapshot: {
          id: topic.id,
          title: topic.title,
          sourceType: topic.source_type,
          sourceUrl: topic.source_url,
          sourcePostId: topic.source_post_id,
          originalIdea: topic.original_idea,
          coreAngle: topic.core_angle,
          keyPoints: topic.key_points,
        },
      },
      created_by: check.user.id,
    });
    if (topic.status === 'IDEA') {
      await updateContentTopic(topic.id, { status: 'USED' });
    }
    return NextResponse.json(successResponse(draft, `已创建${target.label}草稿`), { status: 201 });
  } catch (error) {
    console.error('从选题创建草稿失败:', error);
    return NextResponse.json(errorResponse(error instanceof Error ? error.message : '从选题创建草稿失败'), { status: 500 });
  }
}
