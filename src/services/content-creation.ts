import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ChatPromptTemplate } from '@/lib/ai';
import { createAIChain } from '@/lib/ai';
import { getPrisma } from '@/lib/prisma';
import { getPostById } from '@/services/post';
import { formatAiJob } from '@/services/ai-job';
import type { ImageGenerationJobView } from '@/services/image-gen-job';
import type { ImageGenOptions } from '@/services/image-gen';
import { Prisma, type TbAiJob } from '@/generated/prisma-client/client';
import { generateUuid } from '@/lib/uuid';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_BLOG_CONTENT_LENGTH = 9000;
const DRAFT_IMAGES_KEY = 'draftImages';
const XHS_PROMPTS_DIR = process.env.CONTENT_XHS_PROMPTS_DIR || '/Users/nnnnzs/project/xhs/prompts';

export const CONTENT_DRAFT_TYPES = ['note', 'article', 'short_video', 'checklist', 'faq'] as const;
export const CONTENT_DRAFT_STATUSES = ['DRAFT', 'ASSET_PENDING', 'READY', 'PUBLISHED', 'ARCHIVED'] as const;
export const CONTENT_TOPIC_STATUSES = ['IDEA', 'USED', 'ARCHIVED'] as const;
export const CONTENT_TOPIC_SOURCE_TYPES = ['idea', 'blog', 'url', 'website'] as const;
export const CONTENT_TEMPLATE_TYPES = ['prompt', 'voice_style', 'visual', 'checklist', 'context'] as const;
export const CONTENT_TEMPLATE_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const;
export const CONTENT_TEMPLATE_SCENARIOS = [
  'blog_to_xhs_note',
  'blog_to_short_video',
  'tts',
  'image_card',
  'content_agent',
] as const;

export type ContentDraftType = typeof CONTENT_DRAFT_TYPES[number];
export type ContentDraftStatus = typeof CONTENT_DRAFT_STATUSES[number];
export type ContentTopicStatus = typeof CONTENT_TOPIC_STATUSES[number];
export type ContentTopicSourceType = typeof CONTENT_TOPIC_SOURCE_TYPES[number];
export type ContentTemplateType = typeof CONTENT_TEMPLATE_TYPES[number];
export type ContentTemplateStatus = typeof CONTENT_TEMPLATE_STATUSES[number];
export type ContentTemplateScenario = typeof CONTENT_TEMPLATE_SCENARIOS[number];

export type ContentAssetSource = 'generated' | 'uploaded';

interface PageParams {
  pageNum?: number;
  pageSize?: number;
  query?: string;
  status?: string;
}

export interface TopicQueryParams extends PageParams {
  sourcePostId?: number;
  userId?: number;
}

export interface DraftQueryParams extends PageParams {
  platform?: string;
  type?: string;
  topicId?: number;
  userId?: number;
}

export interface AssetQueryParams extends PageParams {
  type?: string;
  usage?: string;
  group?: string;
  source?: ContentAssetSource;
  favorite?: boolean;
  draftId?: number;
  topicId?: number;
  userId?: number;
}

export interface TemplateQueryParams extends PageParams {
  type?: string;
  scenario?: string;
  userId?: number;
}

export interface CreateTopicInput {
  title: string;
  source_type?: ContentTopicSourceType | string;
  source_url?: string | null;
  original_idea?: string | null;
  core_angle?: string | null;
  key_points?: string[] | null;
  description?: string | null;
  pillar?: string | null;
  series?: string | null;
  status?: string;
  priority?: number;
  source_post_id?: number | null;
  source_note?: string | null;
  ai_reason?: string | null;
  created_by?: number | null;
}

export type UpdateTopicInput = Partial<Omit<CreateTopicInput, 'created_by'>>;

export interface CreateDraftSlideInput {
  title?: string | null;
  bullets?: string[] | null;
  prompt?: string | null;
}

export interface CreateDraftInput {
  topic_id?: number | null;
  source_post_id?: number | null;
  platform?: string;
  type?: ContentDraftType | string;
  title: string;
  hook?: string | null;
  body?: string | null;
  tags?: string[] | null;
  status?: ContentDraftStatus | string;
  generation_snapshot_json?: Prisma.InputJsonValue;
  created_by?: number | null;
  slides?: CreateDraftSlideInput[];
}

export interface UpdateDraftInput {
  title?: string;
  hook?: string | null;
  body?: string | null;
  tags?: string[] | null;
  type?: ContentDraftType | string;
  status?: ContentDraftStatus | string;
}

export interface DraftImageItem {
  id: string;
  assetId: number;
  title: string | null;
  imageUrl: string;
  group: string | null;
  sortOrder: number;
  remark: string | null;
  addedAt: string;
}

export interface UpdateDraftImageInput {
  id: string;
  sortOrder: number;
  remark?: string | null;
}

export interface CreateAssetInput {
  draft_id?: number | null;
  topic_id?: number | null;
  type?: string;
  usage?: string | null;
  title?: string | null;
  cdn_url?: string | null;
  cos_key?: string | null;
  local_path?: string | null;
  ai_job_id?: number | null;
  created_by?: number | null;
}

export interface CreateGeneratedImageAssetInput {
  job: ImageGenerationJobView;
  options: ImageGenOptions;
  title?: string | null;
  group?: string | null;
  referenceAssetIds?: number[];
  created_by?: number | null;
}

export interface CreateUploadedImageAssetInput {
  title?: string | null;
  group?: string | null;
  cdn_url: string;
  cos_key?: string | null;
  originalFilename: string;
  mimeType?: string | null;
  created_by?: number | null;
}

export interface CreateLinkedImageAssetInput {
  title?: string | null;
  group?: string | null;
  imageUrl: string;
  created_by?: number | null;
}

export interface UpdateContentImageAssetInput {
  title?: string | null;
  group?: string | null;
  isFavorite?: boolean;
}

export interface CreateContentTemplateInput {
  name: string;
  type: ContentTemplateType | string;
  scenario: ContentTemplateScenario | string;
  content: string;
  variables_json?: Prisma.InputJsonValue | null;
  output_schema_json?: Prisma.InputJsonValue | null;
  version?: number;
  status?: ContentTemplateStatus | string;
  source_path?: string | null;
  created_by?: number | null;
}

export interface UpdateContentTemplateInput {
  name?: string;
  type?: ContentTemplateType | string;
  scenario?: ContentTemplateScenario | string;
  content?: string;
  variables_json?: Prisma.InputJsonValue | null;
  output_schema_json?: Prisma.InputJsonValue | null;
  version?: number;
  status?: ContentTemplateStatus | string;
  source_path?: string | null;
}

interface XhsPromptTemplateSeed {
  /** xhs 项目下的文件名；与 content 二选一 */
  fileName?: string;
  sourcePath: string;
  name: string;
  type: ContentTemplateType;
  scenario: ContentTemplateScenario;
  variables: Prisma.InputJsonObject;
  outputSchema?: Prisma.InputJsonObject;
  /** 内置模板正文；提供时不再读取 xhs 文件（用于 content_agent 等自有 system prompt） */
  content?: string;
}

export interface GenerateTopicsFromPostInput {
  postId: number;
  limit?: number;
  userId?: number | null;
}

function normalizePage(params: PageParams) {
  const pageNum = Math.max(1, Number(params.pageNum) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE),
  );

  return { pageNum, pageSize };
}

function cleanString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toNullableString(value?: string | null) {
  return cleanString(value) ?? null;
}

function normalizeTopicDedupKey(input: Pick<CreateTopicInput, 'title' | 'source_type' | 'source_url' | 'source_post_id'>): string {
  const title = input.title.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');
  const source = input.source_post_id
    ? `post:${input.source_post_id}`
    : cleanString(input.source_url)?.replace(/^https?:\/\//i, '').replace(/\/$/, '').toLocaleLowerCase('zh-CN')
      ?? `type:${input.source_type || 'idea'}`;
  return `${title}|${source}`;
}

function normalizeTopicSourceType(input: Pick<CreateTopicInput, 'source_type' | 'source_url' | 'source_post_id'>): string {
  if (input.source_type) return input.source_type;
  if (input.source_post_id) return 'blog';
  return input.source_url ? 'url' : 'idea';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactJsonRecord(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Prisma.InputJsonObject;
}

function toPrismaJson(value?: Prisma.InputJsonValue | null) {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
}

function readJsonRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeDraftImageItem(value: unknown, index: number): DraftImageItem | null {
  if (!isRecord(value)) return null;
  const assetId = value.assetId;
  const sortOrder = value.sortOrder;
  if (
    typeof value.id !== 'string'
    || typeof assetId !== 'number'
    || !Number.isInteger(assetId)
    || typeof value.imageUrl !== 'string'
    || value.imageUrl.length === 0
    || typeof value.addedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    assetId,
    title: typeof value.title === 'string' ? value.title : null,
    imageUrl: value.imageUrl,
    group: typeof value.group === 'string' ? value.group : null,
    sortOrder: typeof sortOrder === 'number' && Number.isInteger(sortOrder) && sortOrder > 0
      ? sortOrder
      : index + 1,
    remark: typeof value.remark === 'string' ? toNullableString(value.remark) : null,
    addedAt: value.addedAt,
  };
}

function normalizeDraftImages(images: DraftImageItem[]): DraftImageItem[] {
  return [...images]
    .sort((left, right) => (
      left.sortOrder - right.sortOrder
      || left.addedAt.localeCompare(right.addedAt)
      || left.id.localeCompare(right.id)
    ))
    .map((image, index) => ({
      ...image,
      sortOrder: index + 1,
    }));
}

function readDraftImages(value: unknown): DraftImageItem[] {
  const snapshot = readJsonRecord(value);
  const images = snapshot[DRAFT_IMAGES_KEY];
  return Array.isArray(images)
    ? normalizeDraftImages(
        images
          .map(normalizeDraftImageItem)
          .filter((image): image is DraftImageItem => image !== null),
      )
    : [];
}

function writeDraftImages(value: unknown, images: DraftImageItem[]): Prisma.InputJsonObject {
  return compactJsonRecord({
    ...readJsonRecord(value),
    [DRAFT_IMAGES_KEY]: normalizeDraftImages(images),
  });
}

function formatContentImageJob(job: TbAiJob) {
  const baseJob = formatAiJob(job);
  if (!baseJob) return null;

  const extJson = baseJob.extJson || {};
  const referenceImageUrls = Array.isArray(extJson.edit_image_urls)
    ? extJson.edit_image_urls.filter((url): url is string => typeof url === 'string')
    : (typeof extJson.edit_image_url === 'string' ? [extJson.edit_image_url] : []);

  return {
    ...baseJob,
    mode: extJson.mode === 'edit' ? 'edit' : 'generate',
    group: typeof extJson.group === 'string' ? extJson.group : null,
    referenceImageUrls,
    imageUrl: baseJob.resourceUrl,
  };
}

function clampPriority(priority?: number) {
  if (!Number.isFinite(priority)) return 3;
  return Math.min(5, Math.max(1, Math.round(priority ?? 3)));
}

function extractJsonObject(text: string) {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 返回内容不是 JSON 对象');
  }

  return withoutFence.slice(start, end + 1);
}

const aiTopicSchema = z.object({
  title: z.string().min(1).max(80),
  originalIdea: z.string().min(1).max(800),
  coreAngle: z.string().min(1).max(800),
  keyPoints: z.array(z.string().min(1).max(500)).min(1).max(8),
});

const aiTopicResponseSchema = z.object({
  topics: z.array(aiTopicSchema).min(1).max(8),
});

const xhsPromptTemplateSeeds: XhsPromptTemplateSeed[] = [
  {
    fileName: 'blog-to-xhs-note.md',
    sourcePath: 'xhs/prompts/blog-to-xhs-note.md',
    name: '博客转小红书图文',
    type: 'prompt',
    scenario: 'blog_to_xhs_note',
    variables: {
      variables: [
        { name: 'BLOG_CONTENT', label: '博客正文', required: true },
      ],
      defaultImageSize: '1080x1440',
      defaultImageQuality: 'medium',
    },
    outputSchema: {
      type: 'object',
      required: ['title', 'hook', 'slides', 'body', 'tags', 'remotionProps', 'coverPrompt', 'slidePrompts'],
      properties: {
        title: { type: 'string' },
        hook: { type: 'string' },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            required: ['title', 'bullets'],
            properties: {
              title: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        body: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        remotionProps: { type: 'object' },
        coverPrompt: { type: 'string' },
        slidePrompts: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    fileName: 'blog-to-short-video.md',
    sourcePath: 'xhs/prompts/blog-to-short-video.md',
    name: '博客转短视频脚本',
    type: 'prompt',
    scenario: 'blog_to_short_video',
    variables: {
      variables: [
        { name: 'BLOG_CONTENT', label: '博客正文', required: true },
      ],
      durationSeconds: '30-60',
      targetPlatforms: ['douyin', 'xhs_video', 'wechat_video'],
    },
    outputSchema: {
      type: 'object',
      required: ['title', 'opening', 'script', 'caption', 'tags', 'remotionProps'],
      properties: {
        title: { type: 'string' },
        opening: { type: 'string' },
        script: { type: 'array', items: { type: 'string' } },
        caption: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        remotionProps: { type: 'object' },
      },
    },
  },
  {
    fileName: 'mimo-tts-style.md',
    sourcePath: 'xhs/prompts/mimo-tts-style.md',
    name: 'MiMo TTS 风格',
    type: 'voice_style',
    scenario: 'tts',
    variables: {
      variants: [
        { key: 'tutorial', label: '实战教程' },
        { key: 'debug_review', label: '踩坑复盘' },
        { key: 'project_review', label: '项目复盘' },
      ],
      voiceBrand: '倪同学搞AI',
    },
  },
  {
    // 创作助手 system prompt，由 create-agent 加载
    sourcePath: 'builtin/content-agent-system-prompt.md',
    name: '创作助手 System Prompt',
    type: 'context',
    scenario: 'content_agent',
    variables: { variables: [
      { name: 'draftTitle', label: '草稿标题', required: false },
      { name: 'draftType', label: '草稿类型', required: false },
    ] },
    content: `你是「倪同学搞AI」内容创作中台的创作助手，服务场景是把博客文章和选题加工成小红书图文 / 短视频脚本草稿。

当前草稿上下文：
- 标题：{draftTitle}
- 类型：{draftType}

你可以使用以下工具：
- read_prompt_template：读取指定场景的提示词模板（如 blog_to_xhs_note），按里面的方法论产出内容
- get_draft：读取当前草稿的标题、正文、图卡、已选图片
- search_posts / get_post_content：检索博客文章作为创作素材
- generate_image：提交文生图或图文编辑异步任务，返回 jobId
- poll_image_job：轮询文生图任务状态，成功返回 CDN URL
- emit_draft_patch：把你建议写进草稿的内容以结构化 patch 形式发给前端，等待用户确认

工作原则：
1. 先理解用户意图，需要方法论时先用 read_prompt_template 读对应模板，再按模板产出。
2. 修改草稿内容（标题、hook、正文、标签、图卡）时，禁止只在对话里贴文本，必须调用 emit_draft_patch 工具提交结构化 patch。前端会展示差异并等待用户确认，写权限在用户手里，用户确认应用并点保存才落库。
3. 文生图是异步任务：先 generate_image 拿 jobId，再 poll_image_job 轮询直到成功，拿到 CDN URL 后通过 emit_draft_patch 的 addImages 字段提交待确认图片建议。轮询不要超过 30 次。
4. 回答简洁，多用工具少用嘴。最终给用户的文字总结要说明你做了什么、建议改哪些字段，提醒用户确认建议并保存。
5. 风格：倪同学搞AI，前端工程师转 AI 应用开发实战，不讲玄学，只讲能跑起来的东西。小红书文案要有钩子、有要点、口语化。`,
  },
];

function buildTopicWhere(params: TopicQueryParams): Prisma.ContentTopicWhereInput {
  const where: Prisma.ContentTopicWhereInput = {};
  const query = cleanString(params.query);

  if (params.status) {
    where.status = params.status;
  }

  if (params.sourcePostId) {
    where.source_post_id = params.sourcePostId;
  }

  if (query) {
    where.OR = [
      { title: { contains: query } },
      { original_idea: { contains: query } },
      { core_angle: { contains: query } },
      { source_url: { contains: query } },
      { description: { contains: query } },
      { pillar: { contains: query } },
      { series: { contains: query } },
      { source_note: { contains: query } },
      { ai_reason: { contains: query } },
    ];
  }

  if (params.userId) {
    where.created_by = params.userId;
  }

  return where;
}

function buildDraftWhere(params: DraftQueryParams): Prisma.ContentDraftWhereInput {
  const where: Prisma.ContentDraftWhereInput = {};
  const query = cleanString(params.query);

  if (params.status) {
    where.status = params.status;
  }
  if (params.platform) {
    where.platform = params.platform;
  }
  if (params.type) {
    where.type = params.type;
  }
  if (params.topicId) {
    where.topic_id = params.topicId;
  }
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { hook: { contains: query } },
      { body: { contains: query } },
    ];
  }

  if (params.userId) {
    where.created_by = params.userId;
  }

  return where;
}

function buildAssetWhere(params: AssetQueryParams): Prisma.ContentAssetWhereInput {
  const andFilters: Prisma.ContentAssetWhereInput[] = [{ type: 'image' }];
  const where: Prisma.ContentAssetWhereInput = {};
  const query = cleanString(params.query);
  const group = cleanString(params.group) ?? cleanString(params.usage);

  if (group) {
    where.usage = group;
  }
  if (params.source === 'generated') {
    andFilters.push({ ai_job_id: { not: null } });
  } else if (params.source === 'uploaded') {
    andFilters.push({ ai_job_id: null });
  }
  if (typeof params.favorite === 'boolean') {
    andFilters.push({ is_favorite: params.favorite });
  }
  if (params.draftId) {
    where.draft_id = params.draftId;
  }
  if (params.topicId) {
    where.topic_id = params.topicId;
  }
  if (params.userId) {
    andFilters.push({ created_by: params.userId });
  }
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { cdn_url: { contains: query } },
      { cos_key: { contains: query } },
      { local_path: { contains: query } },
    ];
  }
  where.AND = andFilters;

  return where;
}

function buildTemplateWhere(params: TemplateQueryParams): Prisma.ContentTemplateWhereInput {
  const where: Prisma.ContentTemplateWhereInput = {};
  const query = cleanString(params.query);

  if (params.status) {
    where.status = params.status;
  }
  if (params.type) {
    where.type = params.type;
  }
  if (params.scenario) {
    where.scenario = params.scenario;
  }
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { scenario: { contains: query } },
      { content: { contains: query } },
      { source_path: { contains: query } },
    ];
  }

  if (params.userId) {
    where.OR = [
      { created_by: params.userId },
      { created_by: null },
    ];
  }

  return where;
}

export async function listContentTopics(params: TopicQueryParams = {}) {
  const prisma = await getPrisma();
  const { pageNum, pageSize } = normalizePage(params);
  const where = buildTopicWhere(params);

  const [record, total] = await Promise.all([
    prisma.contentTopic.findMany({
      where,
      include: {
        _count: {
          select: {
            drafts: true,
            assets: true,
          },
        },
      },
      orderBy: [
        { updated_at: 'desc' },
      ],
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contentTopic.count({ where }),
  ]);

  return { record, total, pageNum, pageSize };
}

export async function createContentTopic(input: CreateTopicInput) {
  const prisma = await getPrisma();
  const sourceType = normalizeTopicSourceType(input);
  const dedupKey = normalizeTopicDedupKey({ ...input, source_type: sourceType });
  const duplicate = await prisma.contentTopic.findFirst({
    where: {
      OR: [
        { dedup_key: dedupKey },
        ...(input.source_post_id
          ? [{ title: input.title.trim(), source_post_id: input.source_post_id }]
          : []),
      ],
    },
    select: { id: true, title: true },
  });

  if (duplicate) {
    throw new Error(`相似选题已存在：${duplicate.title}`);
  }

  return prisma.contentTopic.create({
    data: {
      title: input.title.trim(),
      source_type: sourceType,
      source_url: toNullableString(input.source_url),
      original_idea: toNullableString(input.original_idea),
      core_angle: toNullableString(input.core_angle),
      key_points: input.key_points?.length ? input.key_points : undefined,
      dedup_key: dedupKey,
      description: toNullableString(input.description),
      pillar: toNullableString(input.pillar),
      series: toNullableString(input.series),
      status: input.status || 'IDEA',
      priority: clampPriority(input.priority),
      source_post_id: input.source_post_id ?? null,
      source_note: toNullableString(input.source_note),
      ai_reason: toNullableString(input.ai_reason),
      created_by: input.created_by ?? null,
    },
  });
}

export async function getContentTopic(topicId: number) {
  const prisma = await getPrisma();
  return prisma.contentTopic.findUnique({
    where: { id: topicId },
    include: { _count: { select: { drafts: true, assets: true } } },
  });
}

export async function updateContentTopic(topicId: number, input: UpdateTopicInput) {
  const prisma = await getPrisma();
  const existing = await getContentTopic(topicId);
  if (!existing) throw new Error('选题不存在');

  const title = input.title?.trim() || existing.title;
  const sourceType = normalizeTopicSourceType({
    source_type: input.source_type ?? existing.source_type,
    source_url: input.source_url === undefined ? existing.source_url : input.source_url,
    source_post_id: input.source_post_id === undefined ? existing.source_post_id : input.source_post_id,
  });
  const dedupKey = normalizeTopicDedupKey({
    title,
    source_type: sourceType,
    source_url: input.source_url === undefined ? existing.source_url : input.source_url,
    source_post_id: input.source_post_id === undefined ? existing.source_post_id : input.source_post_id,
  });
  const duplicate = await prisma.contentTopic.findFirst({
    where: { dedup_key: dedupKey, id: { not: topicId } },
    select: { id: true, title: true },
  });
  if (duplicate) throw new Error(`相似选题已存在：${duplicate.title}`);

  return prisma.contentTopic.update({
    where: { id: topicId },
    data: {
      title,
      source_type: sourceType,
      source_url: input.source_url === undefined ? undefined : toNullableString(input.source_url),
      original_idea: input.original_idea === undefined ? undefined : toNullableString(input.original_idea),
      core_angle: input.core_angle === undefined ? undefined : toNullableString(input.core_angle),
      key_points: input.key_points === undefined ? undefined : input.key_points ?? Prisma.JsonNull,
      dedup_key: dedupKey,
      status: input.status,
      source_post_id: input.source_post_id,
    },
  });
}

export async function deleteContentTopic(topicId: number) {
  const prisma = await getPrisma();
  return prisma.contentTopic.delete({ where: { id: topicId } });
}

export async function listContentDrafts(params: DraftQueryParams = {}) {
  const prisma = await getPrisma();
  const { pageNum, pageSize } = normalizePage(params);
  const where = buildDraftWhere(params);

  const [drafts, total] = await Promise.all([
    prisma.contentDraft.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contentDraft.count({ where }),
  ]);

  const record = drafts.map((draft) => ({
    ...draft,
    selected_images: readDraftImages(draft.generation_snapshot_json),
  }));

  return { record, total, pageNum, pageSize };
}

export async function createContentDraft(input: CreateDraftInput) {
  const prisma = await getPrisma();

  const draft = await prisma.contentDraft.create({
    data: {
      topic_id: input.topic_id ?? null,
      source_post_id: input.source_post_id ?? null,
      platform: input.platform || 'xhs',
      type: input.type || 'note',
      title: input.title.trim(),
      hook: toNullableString(input.hook),
      body: toNullableString(input.body),
      tags_json: input.tags ? input.tags : undefined,
      status: input.status || 'DRAFT',
      generation_snapshot_json: input.generation_snapshot_json,
      created_by: input.created_by ?? null,
      slides: input.slides?.length
        ? {
            create: input.slides.map((slide, index) => ({
              sort_order: index + 1,
              title: toNullableString(slide.title),
              bullets_json: slide.bullets ?? undefined,
              prompt: toNullableString(slide.prompt),
            })),
          }
        : undefined,
    },
    include: {
      slides: {
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  return {
    ...draft,
    selected_images: readDraftImages(draft.generation_snapshot_json),
  };
}

export async function getContentDraft(id: number) {
  const prisma = await getPrisma();
  const draft = await prisma.contentDraft.findUnique({
    where: { id },
    include: {
      slides: {
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  if (!draft) return null;

  return {
    ...draft,
    selected_images: readDraftImages(draft.generation_snapshot_json),
  };
}

export async function updateContentDraft(id: number, input: UpdateDraftInput) {
  const prisma = await getPrisma();
  const data: Prisma.ContentDraftUpdateInput = {};

  if (input.title !== undefined) {
    data.title = input.title.trim();
  }
  if (input.hook !== undefined) {
    data.hook = toNullableString(input.hook);
  }
  if (input.body !== undefined) {
    data.body = toNullableString(input.body);
  }
  if (input.tags !== undefined) {
    data.tags_json = input.tags ?? undefined;
  }
  if (input.type !== undefined) {
    data.type = input.type;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }

  const draft = await prisma.contentDraft.update({
    where: { id },
    data,
    include: {
      slides: {
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  return {
    ...draft,
    selected_images: readDraftImages(draft.generation_snapshot_json),
  };
}

export async function deleteContentDraft(id: number) {
  const prisma = await getPrisma();
  await prisma.contentDraft.delete({
    where: { id },
  });
}

export async function addContentDraftImage(draftId: number, assetId: number) {
  const prisma = await getPrisma();
  const [draft, asset] = await Promise.all([
    prisma.contentDraft.findUnique({ where: { id: draftId } }),
    prisma.contentAsset.findFirst({
      where: {
        id: assetId,
        type: 'image',
        cdn_url: { not: null },
      },
      select: {
        id: true,
        title: true,
        usage: true,
        cdn_url: true,
      },
    }),
  ]);

  if (!draft) {
    throw new Error('草稿不存在');
  }
  if (draft.status !== 'DRAFT') {
    throw new Error('只能添加到草稿状态的草稿');
  }
  if (!asset?.cdn_url) {
    throw new Error('图片素材不存在或尚未生成完成');
  }

  const images = readDraftImages(draft.generation_snapshot_json);
  const nextImages: DraftImageItem[] = [
    ...images,
    {
      id: generateUuid(),
      assetId: asset.id,
      title: asset.title,
      imageUrl: asset.cdn_url,
      group: asset.usage,
      sortOrder: images.length + 1,
      remark: null,
      addedAt: new Date().toISOString(),
    },
  ];
  const normalizedImages = normalizeDraftImages(nextImages);

  const updated = await prisma.contentDraft.update({
    where: { id: draftId },
    data: {
      generation_snapshot_json: writeDraftImages(draft.generation_snapshot_json, normalizedImages),
    },
  });

  return {
    ...updated,
    selected_images: normalizedImages,
  };
}

export async function removeContentDraftImage(draftId: number, imageId: string) {
  const prisma = await getPrisma();
  const draft = await prisma.contentDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw new Error('草稿不存在');
  }

  const images = readDraftImages(draft.generation_snapshot_json);
  const nextImages = normalizeDraftImages(images.filter((image) => image.id !== imageId));

  const updated = await prisma.contentDraft.update({
    where: { id: draftId },
    data: {
      generation_snapshot_json: writeDraftImages(draft.generation_snapshot_json, nextImages),
    },
  });

  return {
    ...updated,
    selected_images: nextImages,
  };
}

export async function updateContentDraftImages(draftId: number, input: UpdateDraftImageInput[]) {
  const prisma = await getPrisma();
  const draft = await prisma.contentDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw new Error('草稿不存在');
  }

  const images = readDraftImages(draft.generation_snapshot_json);
  const imageIds = new Set(images.map((image) => image.id));
  const seenUpdateIds = new Set<string>();
  const updateMap = new Map<string, UpdateDraftImageInput>();

  for (const item of input) {
    if (!imageIds.has(item.id)) {
      throw new Error('草稿图片不存在');
    }
    if (seenUpdateIds.has(item.id)) {
      throw new Error('草稿图片更新项重复');
    }
    seenUpdateIds.add(item.id);
    updateMap.set(item.id, item);
  }

  const nextImages = normalizeDraftImages(images.map((image) => {
    const item = updateMap.get(image.id);
    if (!item) return image;

    return {
      ...image,
      sortOrder: item.sortOrder,
      remark: item.remark === undefined ? image.remark : toNullableString(item.remark),
    };
  }));

  const updated = await prisma.contentDraft.update({
    where: { id: draftId },
    data: {
      generation_snapshot_json: writeDraftImages(draft.generation_snapshot_json, nextImages),
    },
  });

  return {
    ...updated,
    selected_images: nextImages,
  };
}

export async function listContentAssets(params: AssetQueryParams = {}) {
  const prisma = await getPrisma();
  const { pageNum, pageSize } = normalizePage(params);
  const where = buildAssetWhere(params);

  const [assets, total] = await Promise.all([
    prisma.contentAsset.findMany({
      where,
      include: {
        draft: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        topic: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contentAsset.count({ where }),
  ]);

  const aiJobIds = assets
    .map((asset) => asset.ai_job_id)
    .filter((id): id is number => typeof id === 'number');
  const aiJobs = aiJobIds.length > 0
    ? await prisma.tbAiJob.findMany({
        where: {
          id: { in: aiJobIds },
          type: 'image-gen',
        },
      })
    : [];
  const aiJobMap = new Map(aiJobs.map((job) => [job.id, formatContentImageJob(job)] as const));
  const record = assets.map((asset) => ({
    ...asset,
    image_job: asset.ai_job_id ? aiJobMap.get(asset.ai_job_id) ?? null : null,
  }));

  return { record, total, pageNum, pageSize };
}

export async function createContentAsset(input: CreateAssetInput) {
  const prisma = await getPrisma();

  return prisma.contentAsset.create({
    data: {
      draft_id: input.draft_id ?? null,
      topic_id: input.topic_id ?? null,
      type: input.type || 'image',
      usage: toNullableString(input.usage),
      title: toNullableString(input.title),
      cdn_url: toNullableString(input.cdn_url),
      cos_key: toNullableString(input.cos_key),
      local_path: toNullableString(input.local_path),
      ai_job_id: input.ai_job_id ?? null,
      created_by: input.created_by ?? null,
    },
  });
}

export async function createGeneratedContentImageAsset(input: CreateGeneratedImageAssetInput) {
  const title = cleanString(input.title) ?? input.options.prompt.slice(0, 80);

  return createContentAsset({
    type: 'image',
    usage: input.group,
    title,
    cdn_url: input.job.reservedCdnUrl ?? input.job.imageUrl,
    cos_key: input.job.cosKey,
    ai_job_id: input.job.id,
    created_by: input.created_by,
  });
}

export async function createUploadedContentImageAsset(input: CreateUploadedImageAssetInput) {
  return createContentAsset({
    type: 'image',
    usage: input.group,
    title: cleanString(input.title) ?? input.originalFilename,
    cdn_url: input.cdn_url,
    cos_key: input.cos_key,
    created_by: input.created_by,
  });
}

export async function createLinkedContentImageAsset(input: CreateLinkedImageAssetInput) {
  return createContentAsset({
    type: 'image',
    usage: input.group,
    title: cleanString(input.title) ?? input.imageUrl,
    cdn_url: input.imageUrl,
    created_by: input.created_by,
  });
}

export async function updateContentImageAsset(id: number, input: UpdateContentImageAssetInput) {
  const prisma = await getPrisma();
  const asset = await prisma.contentAsset.findFirst({
    where: {
      id,
      type: 'image',
    },
  });

  if (!asset) return null;

  const data: Prisma.ContentAssetUpdateInput = {};

  if ('title' in input) {
    data.title = toNullableString(input.title);
  }
  if ('group' in input) {
    data.usage = toNullableString(input.group);
  }
  if (typeof input.isFavorite === 'boolean') {
    data.is_favorite = input.isFavorite;
  }

  if (Object.keys(data).length === 0) {
    return asset;
  }

  return prisma.contentAsset.update({
    where: { id },
    data,
  });
}

export async function deleteContentImageAsset(id: number) {
  const prisma = await getPrisma();
  const asset = await prisma.contentAsset.findFirst({
    where: { id, type: 'image' },
  });
  if (!asset) return null;

  await prisma.contentAsset.delete({ where: { id } });
  return asset;
}

export async function getContentImageAssetsByIds(ids: number[]) {
  const prisma = await getPrisma();
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));

  if (uniqueIds.length === 0) return [];

  return prisma.contentAsset.findMany({
    where: {
      id: { in: uniqueIds },
      type: 'image',
      cdn_url: { not: null },
    },
    select: {
      id: true,
      title: true,
      cdn_url: true,
    },
  });
}

export async function listContentTemplates(params: TemplateQueryParams = {}) {
  const prisma = await getPrisma();
  const { pageNum, pageSize } = normalizePage(params);
  const where = buildTemplateWhere(params);

  const [record, total] = await Promise.all([
    prisma.contentTemplate.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contentTemplate.count({ where }),
  ]);

  return { record, total, pageNum, pageSize };
}

export async function getContentTemplate(id: number) {
  const prisma = await getPrisma();
  return prisma.contentTemplate.findUnique({
    where: { id },
  });
}

export async function createContentTemplate(input: CreateContentTemplateInput) {
  const prisma = await getPrisma();

  return prisma.contentTemplate.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      scenario: input.scenario,
      content: input.content,
      variables_json: toPrismaJson(input.variables_json),
      output_schema_json: toPrismaJson(input.output_schema_json),
      version: input.version && input.version > 0 ? Math.round(input.version) : 1,
      status: input.status || 'ACTIVE',
      source_path: toNullableString(input.source_path),
      created_by: input.created_by ?? null,
    },
  });
}

export async function updateContentTemplate(id: number, input: UpdateContentTemplateInput) {
  const prisma = await getPrisma();
  const data: Prisma.ContentTemplateUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name.trim();
  }
  if (input.type !== undefined) {
    data.type = input.type;
  }
  if (input.scenario !== undefined) {
    data.scenario = input.scenario;
  }
  if (input.content !== undefined) {
    data.content = input.content;
  }
  if (input.variables_json !== undefined) {
    data.variables_json = toPrismaJson(input.variables_json);
  }
  if (input.output_schema_json !== undefined) {
    data.output_schema_json = toPrismaJson(input.output_schema_json);
  }
  if (input.version !== undefined) {
    data.version = input.version > 0 ? Math.round(input.version) : 1;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.source_path !== undefined) {
    data.source_path = toNullableString(input.source_path);
  }

  return prisma.contentTemplate.update({
    where: { id },
    data,
  });
}

export async function archiveContentTemplate(id: number) {
  return updateContentTemplate(id, { status: 'ARCHIVED' });
}

async function readXhsPromptContent(seed: XhsPromptTemplateSeed) {
  if (seed.content !== undefined) return seed.content;
  if (!seed.fileName) {
    throw new Error(`模板 seed 缺少 fileName 和 content：${seed.sourcePath}`);
  }
  const filePath = path.join(XHS_PROMPTS_DIR, seed.fileName);
  return readFile(filePath, 'utf8');
}

export async function importXhsPromptTemplates(createdBy?: number | null) {
  const prisma = await getPrisma();
  const created = [];
  const updated = [];

  for (const seed of xhsPromptTemplateSeeds) {
    const content = await readXhsPromptContent(seed);
    const existing = await prisma.contentTemplate.findFirst({
      where: { source_path: seed.sourcePath },
    });
    const baseData = {
      name: seed.name,
      type: seed.type,
      scenario: seed.scenario,
      content,
      variables_json: seed.variables,
      output_schema_json: seed.outputSchema ?? Prisma.JsonNull,
      status: 'ACTIVE',
      source_path: seed.sourcePath,
    };

    if (existing) {
      const template = await prisma.contentTemplate.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          version: existing.version + 1,
        },
      });
      updated.push(template);
      continue;
    }

    const template = await prisma.contentTemplate.create({
      data: {
        ...baseData,
        version: 1,
        created_by: createdBy ?? null,
      },
    });
    created.push(template);
  }

  return { created, updated };
}

export async function getContentCreationOverview(userId?: number | null) {
  const prisma = await getPrisma();
  const userFilter = userId ? { created_by: userId } : {};

  const [
    draftTotal,
    draftReady,
    assetTotal,
    topicTotal,
    topicPlanned,
    latestDrafts,
    latestAssets,
    latestTopics,
  ] = await Promise.all([
    prisma.contentDraft.count({ where: userFilter }),
    prisma.contentDraft.count({ where: { ...userFilter, status: 'READY' } }),
    prisma.contentAsset.count({ where: { ...userFilter, type: 'image' } }),
    prisma.contentTopic.count({ where: userFilter }),
    prisma.contentTopic.count({ where: { ...userFilter, status: 'IDEA' } }),
    prisma.contentDraft.findMany({
      where: userFilter,
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        platform: true,
        type: true,
        updated_at: true,
      },
    }),
    prisma.contentAsset.findMany({
      where: { ...userFilter, type: 'image' },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        type: true,
        usage: true,
        cdn_url: true,
        created_at: true,
      },
    }),
    prisma.contentTopic.findMany({
      where: userFilter,
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        source_type: true,
        core_angle: true,
        updated_at: true,
      },
    }),
  ]);

  return {
    stats: {
      draftTotal,
      draftReady,
      assetTotal,
      topicTotal,
      topicPlanned,
    },
    latestDrafts,
    latestAssets,
    latestTopics,
  };
}

async function invokeTopicAI(input: {
  postTitle: string;
  postDescription: string;
  postCategory: string;
  postTags: string;
  postContent: string;
  limit: number;
}) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      [
        '你是技术内容创作中台的选题策划助手。',
        '目标账号定位：前端工程师转 AI 应用开发实战。',
        '选题是后续多平台草稿共用的创作意图，不要把小红书、知乎、抖音等平台格式写进选题。',
        '每个选题只解决一个明确问题，优先真实踩坑、可复现教程、路线、对比清单、项目复盘。',
        '只输出严格 JSON，不要 Markdown，不要解释。',
      ].join('\n'),
    ],
    [
      'human',
      [
        '请基于下面这篇博客，拆出 {limit} 个可复用的创作选题。',
        'originalIdea 说明用户为什么值得做这个主题；coreAngle 说明推荐从什么角度讲；keyPoints 是后续草稿应覆盖的关键事实或步骤。',
        '',
        '输出 JSON 格式：',
        '{"topics":[{"title":"选题标题","originalIdea":"值得做的原因","coreAngle":"推荐创作角度","keyPoints":["关键点一","关键点二"]}]}',
        '',
        '博客标题：{postTitle}',
        '博客描述：{postDescription}',
        '博客分类：{postCategory}',
        '博客标签：{postTags}',
        '博客正文节选：',
        '{postContent}',
      ].join('\n'),
    ],
  ]);

  const scenarios = ['ai_text', 'chat'];
  let lastError: unknown;

  for (const scenario of scenarios) {
    try {
      const chain = await createAIChain(prompt, {
        scenario,
        temperature: 0.35,
        maxTokens: 1800,
        streaming: false,
      });
      const raw = await chain.invoke(input);
      const parsed = JSON.parse(extractJsonObject(raw));
      return aiTopicResponseSchema.parse(parsed).topics;
    } catch (error) {
      lastError = error;
      console.warn(`内容选题 AI 场景 ${scenario} 失败，尝试下一个场景`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI 选题失败');
}

export async function generateTopicsFromPost(input: GenerateTopicsFromPostInput) {
  const limit = Math.min(8, Math.max(1, input.limit || 5));
  const post = await getPostById(input.postId);

  if (!post) {
    throw new Error('博客文章不存在或已删除');
  }

  const topics = await invokeTopicAI({
    postTitle: post.title || '',
    postDescription: post.description || '',
    postCategory: post.category || '',
    postTags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
    postContent: (post.content || '').slice(0, MAX_BLOG_CONTENT_LENGTH),
    limit,
  });

  const created = [];
  const skipped = [];
  const prisma = await getPrisma();

  for (const topic of topics) {
    const existing = await prisma.contentTopic.findFirst({
      where: {
        source_post_id: post.id,
        title: topic.title,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (existing) {
      skipped.push(existing);
      continue;
    }

    const createdTopic = await createContentTopic({
      title: topic.title,
      source_type: 'blog',
      original_idea: topic.originalIdea,
      core_angle: topic.coreAngle,
      key_points: topic.keyPoints,
      source_post_id: post.id,
      source_note: `来自博客《${post.title || post.id}》`,
      created_by: input.userId ?? null,
    });

    created.push(createdTopic);
  }

  return {
    post: {
      id: post.id,
      title: post.title,
      path: post.path,
      category: post.category,
      tags: post.tags,
    },
    suggestions: topics,
    created,
    skipped,
  };
}
