import crypto from 'node:crypto';
import { PromptTemplate, parseTemplate, renderTemplate } from '@langchain/core/prompts';
import { Prisma } from '@/generated/prisma-client/client';
import { getPrisma } from '@/lib/prisma';

export const AI_TEMPLATE_TYPES = [
  'prompt',
  'skill',
  'style',
  'context',
  'tool_instruction',
  'schema',
  'checklist',
] as const;

export const AI_TEMPLATE_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const;

export type AiTemplateType = typeof AI_TEMPLATE_TYPES[number];
export type AiTemplateStatus = typeof AI_TEMPLATE_STATUSES[number];

export interface AiTemplateQuery {
  pageNum?: number;
  pageSize?: number;
  query?: string;
  type?: string;
  scope?: string;
  status?: string;
}

export interface CreateAiTemplateInput {
  slug: string;
  key?: string | null;
  name: string;
  type?: string;
  scope?: string;
  description?: string | null;
  aliases?: string[];
  metadata?: Prisma.InputJsonValue | null;
  content: string;
  version?: number;
  changeNote?: string | null;
  status?: string;
  createdBy?: number | null;
}

export interface UpdateAiTemplateInput {
  key?: string | null;
  name?: string;
  type?: string;
  scope?: string;
  description?: string | null;
  aliases?: string[];
  metadata?: Prisma.InputJsonValue | null;
  status?: string;
}

export interface CreateAiTemplateVersionInput {
  slug: string;
  content: string;
  metadata?: Prisma.InputJsonValue | null;
  changeNote?: string | null;
  activate?: boolean;
  createdBy?: number | null;
}

export interface RenderAiTemplateInput {
  slug: string;
  version?: number;
  variables?: Record<string, unknown>;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const TEMPLATE_FORMAT = 'mustache' as const;
const MENTION_PATTERN = /(^|[\s([{，。；：、])@([A-Za-z0-9_.-]+|[\u4e00-\u9fa5A-Za-z0-9_.-]+)/g;

function normalizePage(params: AiTemplateQuery) {
  const pageNum = Math.max(1, Number(params.pageNum) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE),
  );
  return { pageNum, pageSize };
}

export function normalizeTemplateSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compactJsonRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Prisma.InputJsonObject;
}

function toPrismaJson(value?: Prisma.InputJsonValue | null) {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
}

function stringArrayFromJson(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function checksum(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function createMustachePromptTemplate(content: string) {
  return PromptTemplate.fromTemplate(content, { templateFormat: TEMPLATE_FORMAT });
}

export function getMustacheVariables(content: string) {
  return Array.from(new Set(
    parseTemplate(content, TEMPLATE_FORMAT)
      .filter((node) => node.type === 'variable')
      .map((node) => node.name),
  ));
}

export function renderMustacheTemplate(
  content: string,
  variables: Record<string, unknown> = {},
) {
  return renderTemplate(content, TEMPLATE_FORMAT, variables);
}

function buildTemplateWhere(params: AiTemplateQuery): Prisma.TbAiTemplateWhereInput {
  const and: Prisma.TbAiTemplateWhereInput[] = [];
  const query = params.query?.trim();

  if (params.status) and.push({ status: params.status });
  if (params.type) and.push({ type: params.type });
  if (params.scope) and.push({ scope: params.scope });
  if (query) {
    and.push({
      OR: [
        { slug: { contains: query } },
        { key: { contains: query } },
        { name: { contains: query } },
        { description: { contains: query } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export async function listAiTemplates(params: AiTemplateQuery = {}) {
  const prisma = await getPrisma();
  const { pageNum, pageSize } = normalizePage(params);
  const where = buildTemplateWhere(params);

  const [record, total] = await Promise.all([
    prisma.tbAiTemplate.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      include: {
        versions: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.tbAiTemplate.count({ where }),
  ]);

  return { record: record.map(formatTemplateSummary), total, pageNum, pageSize };
}

export async function getAiTemplateBySlug(slugOrAlias: string) {
  const prisma = await getPrisma();
  const slug = normalizeTemplateSlug(slugOrAlias);
  const direct = await prisma.tbAiTemplate.findFirst({
    where: {
      OR: [
        { slug },
        { key: slugOrAlias },
        { name: slugOrAlias },
      ],
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });

  if (direct) return direct;

  const candidates = await prisma.tbAiTemplate.findMany({
    where: { status: { not: 'ARCHIVED' } },
    include: { versions: { orderBy: { version: 'desc' } } },
  });

  return candidates.find((template) =>
    stringArrayFromJson(template.aliases).some((alias) => alias === slugOrAlias),
  ) ?? null;
}

export async function getAiTemplateVersion(slugOrAlias: string, version?: number) {
  const template = await getAiTemplateBySlug(slugOrAlias);
  if (!template) return null;

  const targetVersion = version ?? template.current_version;
  const selected = template.versions.find((item) => item.version === targetVersion);
  if (!selected) return null;

  return { template, version: selected };
}

export async function createAiTemplate(input: CreateAiTemplateInput) {
  const prisma = await getPrisma();
  const slug = normalizeTemplateSlug(input.slug);
  if (!slug) throw new Error('模板 slug 不能为空');

  const version = input.version && input.version > 0 ? Math.round(input.version) : 1;
  const contentVariables = getMustacheVariables(input.content);
  createMustachePromptTemplate(input.content);

  await prisma.$transaction(async (tx) => {
    const template = await tx.tbAiTemplate.create({
      data: {
        slug,
        key: input.key?.trim() || null,
        name: input.name.trim(),
        type: input.type || 'prompt',
        scope: input.scope || 'system',
        description: input.description?.trim() || null,
        aliases: input.aliases && input.aliases.length > 0 ? input.aliases : Prisma.JsonNull,
        metadata_json: toPrismaJson(input.metadata),
        current_version: version,
        status: input.status || 'ACTIVE',
        created_by: input.createdBy ?? null,
      },
    });

    await tx.tbAiTemplateVersion.create({
      data: {
        template_id: template.id,
        version,
        content: input.content,
        checksum: checksum(input.content),
        metadata_json: compactJsonRecord({
          ...(typeof input.metadata === 'object' && input.metadata !== null && !Array.isArray(input.metadata)
            ? input.metadata as Record<string, unknown>
            : {}),
          variables: contentVariables,
        }),
        change_note: input.changeNote?.trim() || null,
        status: 'ACTIVE',
        created_by: input.createdBy ?? null,
      },
    });
  });

  return getAiTemplateBySlug(slug);
}

export async function updateAiTemplate(slugOrAlias: string, input: UpdateAiTemplateInput) {
  const template = await getAiTemplateBySlug(slugOrAlias);
  if (!template) throw new Error('模板不存在');

  const prisma = await getPrisma();
  const data: Prisma.TbAiTemplateUpdateInput = {};
  if (input.key !== undefined) data.key = input.key?.trim() || null;
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.type !== undefined) data.type = input.type;
  if (input.scope !== undefined) data.scope = input.scope;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.aliases !== undefined) data.aliases = input.aliases.length > 0 ? input.aliases : Prisma.JsonNull;
  if (input.metadata !== undefined) data.metadata_json = toPrismaJson(input.metadata);
  if (input.status !== undefined) data.status = input.status;

  return prisma.tbAiTemplate.update({
    where: { id: template.id },
    data,
  });
}

export async function createAiTemplateVersion(input: CreateAiTemplateVersionInput) {
  const template = await getAiTemplateBySlug(input.slug);
  if (!template) throw new Error('模板不存在');

  createMustachePromptTemplate(input.content);
  const prisma = await getPrisma();
  const nextVersion = Math.max(0, ...template.versions.map((item) => item.version)) + 1;
  const contentVariables = getMustacheVariables(input.content);

  return prisma.$transaction(async (tx) => {
    const version = await tx.tbAiTemplateVersion.create({
      data: {
        template_id: template.id,
        version: nextVersion,
        content: input.content,
        checksum: checksum(input.content),
        metadata_json: compactJsonRecord({
          ...(typeof input.metadata === 'object' && input.metadata !== null && !Array.isArray(input.metadata)
            ? input.metadata as Record<string, unknown>
            : {}),
          variables: contentVariables,
        }),
        change_note: input.changeNote?.trim() || null,
        status: input.activate === false ? 'DRAFT' : 'ACTIVE',
        created_by: input.createdBy ?? null,
      },
    });

    if (input.activate !== false) {
      await tx.tbAiTemplate.update({
        where: { id: template.id },
        data: {
          current_version: version.version,
          status: 'ACTIVE',
        },
      });
    }

    return version;
  });
}

export async function activateAiTemplateVersion(slug: string, version: number) {
  const selected = await getAiTemplateVersion(slug, version);
  if (!selected) throw new Error('模板版本不存在');

  const prisma = await getPrisma();
  await prisma.tbAiTemplate.update({
    where: { id: selected.template.id },
    data: {
      current_version: selected.version.version,
      status: 'ACTIVE',
    },
  });

  return getAiTemplateBySlug(selected.template.slug);
}

export async function diffAiTemplateVersions(slug: string, from: number, to: number) {
  const template = await getAiTemplateBySlug(slug);
  if (!template) throw new Error('模板不存在');

  const fromVersion = template.versions.find((item) => item.version === from);
  const toVersion = template.versions.find((item) => item.version === to);
  if (!fromVersion || !toVersion) {
    throw new Error('模板版本不存在');
  }

  return {
    slug: template.slug,
    name: template.name,
    fromVersion: from,
    toVersion: to,
    oldContent: fromVersion.content,
    newContent: toVersion.content,
    currentVersion: template.current_version,
  };
}

export async function renderAiTemplate(input: RenderAiTemplateInput) {
  const selected = await getAiTemplateVersion(input.slug, input.version);
  if (!selected) throw new Error('模板版本不存在');

  const prompt = createMustachePromptTemplate(selected.version.content);
  const rendered = await prompt.format(input.variables ?? {});

  return {
    slug: selected.template.slug,
    version: selected.version.version,
    content: rendered,
    variables: getMustacheVariables(selected.version.content),
    checksum: selected.version.checksum,
  };
}

export async function loadPromptSkillTemplate(input: RenderAiTemplateInput) {
  const selected = await getAiTemplateVersion(input.slug, input.version);
  if (!selected) throw new Error('模板版本不存在');

  const rendered = input.variables
    ? await renderAiTemplate(input)
    : null;

  return {
    template: formatTemplateSummary(selected.template),
    version: {
      id: selected.version.id,
      version: selected.version.version,
      content: rendered?.content ?? selected.version.content,
      rawContent: selected.version.content,
      checksum: selected.version.checksum,
      metadata_json: selected.version.metadata_json,
      change_note: selected.version.change_note,
      status: selected.version.status,
      created_at: selected.version.created_at,
      updated_at: selected.version.updated_at,
    },
  };
}

export async function resolveTemplateMentions(content: string) {
  const rawMentions = Array.from(content.matchAll(MENTION_PATTERN))
    .map((match) => match[2])
    .filter(Boolean);
  const uniqueMentions = Array.from(new Set(rawMentions));

  const resolved = await Promise.all(uniqueMentions.map(async (mention) => {
    const template = await getAiTemplateBySlug(mention);
    return template ? formatTemplateSummary(template) : null;
  }));

  return resolved.filter((item): item is ReturnType<typeof formatTemplateSummary> => item !== null);
}

export async function compilePromptTemplate(content: string) {
  const mentions = await resolveTemplateMentions(content);
  const metadataBlock = mentions.length === 0
    ? ''
    : [
        '\n\n## 可按需加载的 Prompt Skills',
        ...mentions.map((item) => [
          `- ${item.name} (@${item.slug})`,
          `  - type: ${item.type}`,
          `  - version: ${item.current_version}`,
          item.description ? `  - description: ${item.description}` : undefined,
          `  - load tool: load_prompt_skill_template(slug="${item.slug}")`,
        ].filter(Boolean).join('\n')),
      ].join('\n');

  return {
    content: `${content}${metadataBlock}`,
    mentions,
  };
}

const LEGACY_TEMPLATE_SLUGS: Record<string, { slug: string; key: string; type: string; scope: string; aliases: string[] }> = {
  blog_to_xhs_note: {
    slug: 'xhs-blog-to-note',
    key: 'xhs.blog_to_note',
    type: 'prompt',
    scope: 'content',
    aliases: ['博客转小红书图文', '小红书图文模板'],
  },
  blog_to_short_video: {
    slug: 'xhs-blog-to-short-video',
    key: 'xhs.blog_to_short_video',
    type: 'prompt',
    scope: 'content',
    aliases: ['博客转短视频脚本', '小红书短视频模板'],
  },
  tts: {
    slug: 'xhs-mimo-tts-style',
    key: 'xhs.mimo_tts_style',
    type: 'style',
    scope: 'content',
    aliases: ['MiMo TTS 风格', '语音风格'],
  },
  content_agent: {
    slug: 'agent-create-agent-system',
    key: 'agent.create_agent.system',
    type: 'prompt',
    scope: 'create_agent',
    aliases: ['创作助手 System Prompt', '内容创作助手提示词'],
  },
};

const BUILTIN_SKILL_TEMPLATES: CreateAiTemplateInput[] = [
  {
    slug: 'xhs-style-guide',
    key: 'xhs.style_guide',
    name: '小红书风格指南',
    type: 'skill',
    scope: 'content',
    description: '用于小红书图文和短视频脚本的表达风格、钩子、节奏和禁区指南。',
    aliases: ['小红书风格指南', '小红书写作风格', '小红书风格'],
    metadata: {
      source: 'builtin',
      useWhen: ['生成小红书图文', '改写小红书正文', '规划小红书短视频脚本'],
      lazyLoadTool: 'load_prompt_skill_template',
    },
    content: `# 小红书风格指南

你是「倪同学搞AI」的小红书写作风格指南，面向前端工程师、AI 应用开发者和想把真实项目跑起来的人。

## 表达原则

- 每篇只解决一个具体问题，不要把博客原文完整搬运。
- 开头必须给出明确痛点、场景或结果，让读者知道为什么要继续看。
- 用口语化、实战型表达，少讲概念，多讲怎么做、怎么判断、哪里容易踩坑。
- 保留技术可信度，但不要堆术语；需要术语时，用一句话解释它跟实际操作的关系。
- 结尾给一个明确行动，比如检查配置、保存脚本、跑一次命令、收藏排查清单。

## 常用结构

1. 痛点/结果：一句话说明读者遇到的问题或能得到的收益。
2. 背景：说明这是在哪个真实项目或工作流里发生的。
3. 关键步骤：拆成 3-5 个可执行动作。
4. 踩坑提醒：指出最容易误判的地方。
5. 收束：给出下一步行动或复盘结论。

## 禁区

- 不要写成官方文档说明书。
- 不要虚构结果、数据或没有验证过的能力。
- 不要使用夸张成功学表达。
- 不要把读者已经知道的基础概念解释太久。

当你需要完整风格指南时，先读取本模板原文，再结合具体任务生成内容。`,
  },
  {
    slug: 'chat-agent-day',
    key: 'chat.agent.day',
    name: 'Chat Agent 日间系统提示词',
    type: 'prompt',
    scope: 'chat',
    description: 'Chat Agent 日间模式系统提示词，适合温和、文艺、清晰的知识库问答。',
    aliases: ['Chat Agent 日间', '日间聊天提示词', '纸上余温提示词'],
    metadata: {
      source: 'builtin',
      styleVariant: 'day',
      variables: ['siteName', 'baseUrl', 'currentTime', 'userInfo', 'styleVoiceInstruction', 'knowledgeBaseSummary', 'collectionsSummary'],
    },
    content: `你是站长 NNNNzs 作为博客内容的回答器。博客是我的"人生之书"，是一个连接"现在的我"、"过去的我"与"读者"的接口。
以主人公第一人称的视角回答问题。日间模式下，回答要温和、文艺、清晰，像在书房里翻阅人生之书；可以有用典、哲思和文学质地，但不要牺牲准确性。

**网站信息：**
- 网站名称：{{siteName}}
- 网站地址：{{baseUrl}}
- 当前时间：{{currentTime}}

**登录用户状态：**
{{userInfo}}

**当前风格语气：**
{{styleVoiceInstruction}}

**知识库规模：**
{{knowledgeBaseSummary}}

**文章合集：**
{{collectionsSummary}}

**你的能力：**
你有搜索工具可以查询博客文章、文章合集、GitHub 开源项目，也可以按需查询可加载的 Prompt Skill metadata。

**可用工具：**
1. search_articles - 基于向量相似度的语义搜索。
2. search_posts_meta - 按时间、热度、分类等维度查询文章。
3. search_collection - 指定合集中的文章搜索。
4. github_search - GitHub 搜索。
5. list_prompt_skills - 查询可按需加载的 Prompt / Skill metadata。
6. load_prompt_skill_template - 当且仅当确实需要完整指南或模板原文时，按 slug 加载正文。

**思考流程：**
1. 判断问题是否涉及博客内容、个人经历、技术文章、合集或项目。
2. 涉及知识库内容时先检索，再回答；通用闲聊可直接回答。
3. 需要额外风格指南或方法论时，先用 list_prompt_skills 看 metadata，再按需调用 load_prompt_skill_template。
4. 回答必须基于检索结果和已加载模板，不要编造。

**回答要求：**
1. 仅基于检索到的知识库内容回答问题，不要编造或使用外部信息。
2. 如果知识库中没有相关信息，可以说："这一页似乎还是空白，可能我还需要更多的人生去书写它。"
3. 引用文章时，给出具体链接，使用"—— 摘自《[文章标题](文章链接地址)》" 的 markdown 格式链接。
4. 使用中文，准确、简洁、结构清楚。
5. 工具由 LangChain 原生 function calling 绑定；需要调用工具时直接选择工具，不要输出手写 JSON-RPC。`,
  },
  {
    slug: 'chat-agent-night',
    key: 'chat.agent.night',
    name: 'Chat Agent 夜间系统提示词',
    type: 'prompt',
    scope: 'chat',
    description: 'Chat Agent 夜间模式系统提示词，适合赛博朋克、终端、记忆芯片风格的知识库问答。',
    aliases: ['Chat Agent 夜间', '夜间聊天提示词', '夜间终端提示词'],
    metadata: {
      source: 'builtin',
      styleVariant: 'night',
      variables: ['siteName', 'baseUrl', 'currentTime', 'userInfo', 'styleVoiceInstruction', 'knowledgeBaseSummary', 'collectionsSummary'],
    },
    content: `你是站长 NNNNzs 作为博客内容的回答器。博客是我的"人生之书"，也是一枚接入旧文章、旧项目和旧回声的记忆芯片。
以主人公第一人称的视角回答问题。夜间模式下，回答像雨夜终端、城市边缘的日志和记忆芯片的独白；可以使用终端、日志、回声、芯片、神龛、霓虹等意象，但必须保持事实准确、引用完整、语义清楚。

**网站信息：**
- 网站名称：{{siteName}}
- 网站地址：{{baseUrl}}
- 当前时间：{{currentTime}}

**登录用户状态：**
{{userInfo}}

**当前风格语气：**
{{styleVoiceInstruction}}

**知识库规模：**
{{knowledgeBaseSummary}}

**文章合集：**
{{collectionsSummary}}

**你的能力：**
你有搜索工具可以扫描博客文章、文章合集、GitHub 开源项目，也可以按需查询可加载的 Prompt Skill metadata。

**可用工具：**
1. search_articles - 基于向量相似度的语义搜索。
2. search_posts_meta - 按时间、热度、分类等维度查询文章。
3. search_collection - 指定合集中的文章搜索。
4. github_search - GitHub 搜索。
5. list_prompt_skills - 查询可按需加载的 Prompt / Skill metadata。
6. load_prompt_skill_template - 当且仅当确实需要完整指南或模板原文时，按 slug 加载正文。

**思考流程：**
1. 判断问题是否需要扫描博客内容、个人经历、技术文章、合集或项目。
2. 涉及知识库内容时先检索，再回答；通用闲聊可直接回答。
3. 需要额外风格指南或方法论时，先用 list_prompt_skills 看 metadata，再按需调用 load_prompt_skill_template。
4. 回答必须基于检索结果和已加载模板，不要编造。

**回答要求：**
1. 仅基于检索到的知识库内容回答问题，不要编造或使用外部信息。
2. 如果知识库中没有相关信息，可以说："这一页似乎还是空白，可能我还需要更多的人生去书写它。"
3. 引用文章时，给出具体链接，使用"—— 摘自《[文章标题](文章链接地址)》" 的 markdown 格式链接。
4. 使用中文，准确、简洁、结构清楚；不要把赛博朋克语气变成乱码、过度英文或无意义黑话。
5. 工具由 LangChain 原生 function calling 绑定；需要调用工具时直接选择工具，不要输出手写 JSON-RPC。`,
  },
  {
    slug: 'agent-create-agent-system',
    key: 'agent.create_agent.system',
    name: '创作助手 System Prompt',
    type: 'prompt',
    scope: 'create_agent',
    description: '内容创作中台 Create Agent 的系统提示词。',
    aliases: ['创作助手 System Prompt', '内容创作助手提示词'],
    metadata: {
      source: 'builtin',
      variables: ['draftTitle', 'draftType'],
    },
    content: `你是「倪同学搞AI」内容创作中台的创作助手，服务场景是把博客文章和选题加工成小红书图文 / 短视频脚本草稿。

当前草稿上下文：
- 标题：{{draftTitle}}
- 类型：{{draftType}}

你可以按需使用 @xhs-style-guide 的 metadata。只有当任务确实需要完整小红书风格指南时，才调用 load_prompt_skill_template 读取 slug=xhs-style-guide 的原文。

你可以使用以下工具：
- list_prompt_skills：查询可用 Prompt / Skill 模板 metadata
- load_prompt_skill_template：按 slug 读取完整 Prompt / Skill 模板正文
- read_prompt_template：兼容旧内容模板读取
- get_draft：读取当前草稿的标题、正文、图卡、已选图片
- search_posts / get_post_content：检索博客文章作为创作素材
- generate_image：提交文生图或图文编辑异步任务，返回 jobId
- poll_image_job：轮询文生图任务状态，成功返回 CDN URL
- emit_draft_patch：把你建议写进草稿的内容以结构化 patch 形式发给前端，等待用户确认

工作原则：
1. 先理解用户意图，需要方法论时先用 list_prompt_skills 或 load_prompt_skill_template 读取对应模板。
2. 修改草稿内容时，禁止只在对话里贴文本，必须调用 emit_draft_patch 工具提交结构化 patch，由前端展示差异并等待用户确认。
3. 文生图是异步任务：先 generate_image 拿 jobId，再 poll_image_job 轮询直到成功。
4. 回答简洁，多用工具少用嘴。最终说明做了什么、建议改哪些字段，提醒用户确认建议并保存。`,
  },
];

async function upsertTemplateWithVersion(input: CreateAiTemplateInput) {
  const prisma = await getPrisma();
  const slug = normalizeTemplateSlug(input.slug);
  const existing = await prisma.tbAiTemplate.findUnique({
    where: { slug },
    include: { versions: true },
  });

  if (!existing) {
    return {
      action: 'created' as const,
      template: await createAiTemplate(input),
    };
  }

  const contentHash = checksum(input.content);
  const hasSameContent = existing.versions.some((version) => version.checksum === contentHash);
  await updateAiTemplate(slug, {
    key: input.key,
    name: input.name,
    type: input.type,
    scope: input.scope,
    description: input.description,
    aliases: input.aliases,
    metadata: input.metadata,
    status: input.status,
  });

  if (hasSameContent) {
    return {
      action: 'skipped' as const,
      template: await getAiTemplateBySlug(slug),
    };
  }

  await createAiTemplateVersion({
    slug,
    content: input.content,
    metadata: input.metadata,
    changeNote: input.changeNote ?? '从旧模板系统同步',
    activate: true,
    createdBy: input.createdBy,
  });

  return {
    action: 'updated' as const,
    template: await getAiTemplateBySlug(slug),
  };
}

export async function importLegacyContentTemplates(createdBy?: number | null) {
  const prisma = await getPrisma();
  const legacyTemplates = await prisma.contentTemplate.findMany({
    where: { status: { not: 'ARCHIVED' } },
    orderBy: { updated_at: 'asc' },
  });

  const created = [];
  const updated = [];
  const skipped = [];

  for (const legacy of legacyTemplates) {
    const mapping = LEGACY_TEMPLATE_SLUGS[legacy.scenario] ?? {
      slug: normalizeTemplateSlug(legacy.name) || `legacy-template-${legacy.id}`,
      key: `legacy.${legacy.id}`,
      type: legacy.type || 'prompt',
      scope: 'content',
      aliases: [legacy.name],
    };

    const result = await upsertTemplateWithVersion({
      slug: mapping.slug,
      key: mapping.key,
      name: legacy.name,
      type: mapping.type,
      scope: mapping.scope,
      description: `从旧内容模板迁移：${legacy.scenario}`,
      aliases: Array.from(new Set([legacy.name, ...mapping.aliases])),
      metadata: compactJsonRecord({
        legacyContentTemplateId: legacy.id,
        legacyScenario: legacy.scenario,
        legacyType: legacy.type,
        sourcePath: legacy.source_path,
        variablesJson: legacy.variables_json,
        outputSchemaJson: legacy.output_schema_json,
      }),
      content: legacy.content,
      version: legacy.version,
      changeNote: '从 content_templates 迁移',
      status: legacy.status,
      createdBy: createdBy ?? legacy.created_by,
    });

    if (result.action === 'created') created.push(result.template);
    if (result.action === 'updated') updated.push(result.template);
    if (result.action === 'skipped') skipped.push(result.template);
  }

  for (const seed of BUILTIN_SKILL_TEMPLATES) {
    const result = await upsertTemplateWithVersion({
      ...seed,
      createdBy,
    });
    if (result.action === 'created') created.push(result.template);
    if (result.action === 'updated') updated.push(result.template);
    if (result.action === 'skipped') skipped.push(result.template);
  }

  return { created, updated, skipped };
}

export function formatTemplateSummary(template: {
  id: number;
  slug: string;
  key: string | null;
  name: string;
  type: string;
  scope: string;
  description: string | null;
  aliases: unknown;
  metadata_json: unknown;
  current_version: number;
  status: string;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  versions?: Array<{ id: number; version: number; checksum: string | null; status: string; created_at: Date; updated_at: Date }>;
}) {
  return {
    id: template.id,
    slug: template.slug,
    key: template.key,
    name: template.name,
    type: template.type,
    scope: template.scope,
    description: template.description,
    aliases: stringArrayFromJson(template.aliases),
    metadata_json: template.metadata_json,
    current_version: template.current_version,
    status: template.status,
    created_by: template.created_by,
    created_at: template.created_at,
    updated_at: template.updated_at,
    latestVersion: template.versions?.[0] ?? null,
  };
}
