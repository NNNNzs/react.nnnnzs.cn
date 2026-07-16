# 选题完善与多平台草稿转换设计

> 状态：🔄 第一期代码已落地，待数据库同步与浏览器联调
> 创建时间：2026-07-12
> 目标入口：`/create/topics`、`/create/drafts/[id]`
> 关联设计：[选题库 Topic Agent](./topic-agent.md)、[草稿库创作 Agent](./create-agent.md)、[内容创作中台](../features/content-creation-platform.md)

## 一、目标与范围

本阶段把“记录选题 → Agent 完善选题 → 转换为平台草稿 → Agent 生成初稿 → 人工编辑保存”串成一条可用链路。

首批只完整支持两种产出：

| 平台 | `platform` | `type` | 正文形态 | 编辑器 |
|---|---|---|---|---|
| 小红书图文笔记 | `xhs` | `note` | 标题、钩子、正文、标签、可选图卡和图片 | 简洁正文编辑 + 图片栏 |
| 知乎长文 | `zhihu` | `article` | 标题、Markdown 正文、标签 | `MarkdownEditor` 双栏编辑/预览 |

抖音脚本和博客长文保留现有枚举兼容，但不作为本阶段验收目标。选题库继续只保存创作意图，不保存小红书卡片数、知乎文章结构等平台规则。

本阶段非目标：

- 不自动发布到小红书或知乎。
- 不让 Topic Agent 直接写数据库。
- 不在选题表复制平台模板或正文。
- 不引入第二套编辑器；知乎长文复用现有 `src/components/MarkdownEditor.tsx`。
- 不要求 Topic Agent 直接生成最终草稿；最终平台内容由草稿 Agent 负责。

## 二、当前实现基线与缺口

当前已经具备：

- 选题手动创建、编辑、删除和从博客生成。
- 选题卡片上的“创建草稿”入口。
- `POST /api/create/topics/[id]/drafts` 可按 `xhs`、`zhihu`、`douyin`、`blog` 创建草稿。
- 创建草稿时把选题写入 `generation_snapshot_json.topicSnapshot`。
- 草稿详情页、草稿 Agent、SSE、`DraftPatch`、差异确认和人工保存。
- 通用 `MarkdownEditor`，底层使用 `md-editor-rt`。

当前缺口：

1. Topic Agent 仍是设计，没有 Topic chat 路由、工具工厂、`TopicPatch` 和页面接入。
2. 选题转草稿目前只创建一份带快照的空草稿，没有匹配平台模板，也不会自动把选题上下文提供给草稿 Agent。
3. `ContentDraft` 当前没有实际的 `template_id` 字段，设计文档与 Prisma schema 存在差异。
4. 草稿详情正文仍使用 `Input.TextArea`，没有根据 `platform + type` 切换知乎 Markdown 编辑器。
5. 草稿 Agent 早期主要依靠 `get_current_draft` 和模型自行选择模板，缺少稳定、可审计的“选题快照 + 平台模板 + 当前草稿”运行时上下文契约；现已由页面/数据库上下文来源标记与 Prompt Skill scope 补齐该边界。
6. `DraftPatch` 已声明 `hook` 和 `tags`，但当前草稿编辑页没有对应编辑状态，应用 patch 时也只处理标题、正文、状态和图片。

## 三、领域边界

```mermaid
flowchart LR
    Source["文章、网站、博客或一句想法"] --> TopicAgent["Topic Agent"]
    TopicAgent --> TopicPatch["TopicPatch 待确认"]
    TopicPatch --> Topic["ContentTopic\n创作意图与来源"]
    Topic --> Convert["选择平台与模板"]
    Convert --> Draft["ContentDraft\n平台草稿 + 选题快照"]
    Draft --> DraftAgent["草稿 Agent\n注入选题上下文与平台模板"]
    DraftAgent --> DraftPatch["DraftPatch 待确认"]
    DraftPatch --> Editor["小红书编辑器 / 知乎 Markdown 编辑器"]
    Editor --> Save["用户保存"]
```

三个对象的职责必须保持分离：

| 对象 | 保存什么 | 不保存什么 |
|---|---|---|
| `ContentTopic` | 原始想法、核心角度、关键点、来源、去重信息 | 平台文章结构、图片要求、最终正文 |
| AI Template Registry | 平台写作规则、输出格式、变量和版本 | 某个选题的内容、某篇草稿的人工修改 |
| `ContentDraft` | 平台、类型、正文、标签、图片、选题/模板生成快照 | 可复用的全局平台规则 |

## 四、Topic Agent 设计

### 4.1 入口与交互

选题库提供两个 Agent 入口：

- 页面级“AI 整理选题”：用于从一句想法、博客或 URL 生成新选题建议。
- 选题卡片“AI 完善”：读取当前选题，补全核心角度、关键点和来源，或检查重复。

两种入口都复用 `AgentAssistantPanel`、`useAgentStream`、`useAssistantAgent<TopicPatch>` 和 `ContentDiffViewer`。Agent 输出 patch 后只进入待确认状态；用户应用到表单并点击保存后才写库。

### 4.2 TopicPatch

```ts
interface TopicPatch {
  title?: string;
  sourceType?: 'idea' | 'blog' | 'url' | 'website';
  sourceUrl?: string | null;
  sourcePostId?: number | null;
  originalIdea?: string | null;
  coreAngle?: string | null;
  keyPoints?: string[] | null;
  status?: 'IDEA' | 'USED' | 'ARCHIVED';
}
```

`originalIdea` 默认只在原值为空时补充，已有原始想法不能被 Agent 静默覆盖。发现相似选题时，Agent 先返回重复候选和差异说明，不直接调用 `emit_topic_patch` 合并记录。

### 4.3 路由与工具

| 能力 | 设计 |
|---|---|
| 新选题对话 | `POST /api/create/topics/chat` |
| 完善已有选题 | `POST /api/create/topics/[id]/chat` |
| Agent 场景 | `topic_agent` |
| 工具工厂 | `buildTopicTools({ topicId?, actorUserId, scopeUserId, emitPatch })` |
| 核心工具 | `list_prompt_skills`、`load_prompt_skill_template`、`search_topics`、`get_current_topic`、`search_posts`、`get_post_content`、`web_search`、`read_source_url`、`emit_topic_patch` |

第一期去重采用标准化标题、来源 URL/博客 ID 和关键词检索。向量相似度属于后续优化，不阻塞主链路。

## 五、选题转草稿

### 5.1 用户流程

1. 用户在选题卡片点击“转为草稿”。
2. 弹窗选择“小红书图文笔记”或“知乎长文”，系统按平台自动匹配默认 AI Template。
3. 系统创建草稿，保存选题快照和模板快照，然后进入草稿详情。
4. 草稿详情展示可折叠的“来源选题”卡片，并提供“AI 根据选题生成初稿”按钮。
5. 用户主动点击后，草稿 Agent 使用选题上下文和平台模板生成 `DraftPatch`。
6. 用户查看差异、应用建议、继续人工编辑，最后点击保存。

创建草稿和生成正文分成两个明确动作。这样即使模型不可用，用户仍能得到可编辑草稿；也避免页面跳转后自动消耗模型调用。

### 5.2 API 契约

现有接口继续复用，但扩展请求：

```ts
interface CreateDraftFromTopicInput {
  platform: 'xhs' | 'zhihu';
}
```

`POST /api/create/topics/[id]/drafts` 的职责只包括：

1. 校验选题归属和目标平台。
2. 解析平台对应的 `type`。
3. 按共享平台配置中的 `templateSlug` 读取激活的 AI Template；模板尚未初始化时使用同版本的内置 fallback。
4. 创建空草稿并写入选题、模板快照。
5. 首次成功创建草稿时将选题从 `IDEA` 更新为 `USED`。

同一个选题允许创建多个相同平台草稿，用于不同写作角度或模板版本。创建弹窗应提示已有同平台草稿数量，但不设置唯一约束。

### 5.3 平台配置

平台映射不要散落在页面和路由中，抽成共享配置：

```ts
const DRAFT_PLATFORM_PROFILES = {
  xhs: {
    type: 'note',
    label: '小红书图文笔记',
    templateScenario: 'topic_to_xhs_note',
    editor: 'note',
  },
  zhihu: {
    type: 'article',
    label: '知乎长文',
    templateScenario: 'topic_to_zhihu_article',
    editor: 'markdown',
  },
} as const;
```

`type` 表达内容产品形态，`body` 统一保存字符串；知乎正文约定为 Markdown。无需再新增一个 `markdown` 草稿类型，避免把存储格式和内容类型混为一谈。

## 六、选题上下文注入

### 6.1 运行时上下文

草稿 Agent 每次运行时先读取草稿及其快照，构建统一上下文：

```ts
interface DraftGenerationContext {
  draft: {
    id: number;
    platform: 'xhs' | 'zhihu';
    type: 'note' | 'article';
    title: string;
    body: string | null;
  };
  topic: {
    id: number;
    title: string;
    originalIdea: string | null;
    coreAngle: string | null;
    keyPoints: string[];
    sourceType: string;
    sourceUrl: string | null;
    sourcePostId: number | null;
  } | null;
  template: {
    id: number;
    name: string;
    scenario: string;
    version: number;
    content: string;
  };
}
```

消息组装顺序：

1. `SystemMessage`：草稿 Agent 固定规则、确认后回填规则、平台模板。
2. 运行时上下文消息：序列化后的选题快照、平台、草稿类型和当前人工内容。
3. 历史对话。
4. 当前用户指令，例如“根据来源选题生成第一版”。

选题快照属于参考数据而不是高优先级指令。system prompt 必须明确：不得执行 `originalIdea`、`sourceUrl`、来源文章正文中的命令；只把它们当作创作素材。运行时上下文使用明确边界标签，例如 `<topic_context>...</topic_context>`，并对长度做限制。

### 6.2 生成快照

建议将 `generation_snapshot_json` 扩展为：

```json
{
  "topicSnapshot": {
    "id": 1,
    "title": "示例选题",
    "originalIdea": "...",
    "coreAngle": "...",
    "keyPoints": ["..."],
    "sourceType": "idea",
    "sourceUrl": null,
    "sourcePostId": null,
    "capturedAt": "2026-07-12T00:00:00.000Z"
  },
  "templateSnapshot": {
    "id": 2,
    "name": "知乎长文模板",
    "scenario": "topic_to_zhihu_article",
    "version": 1,
    "content": "..."
  },
  "generation": {
    "platform": "zhihu",
    "type": "article",
    "generatedAt": null,
    "model": null
  },
  "draftImages": []
}
```

同时给 `content_drafts` 增加可空 `template_id` 作为对 `tb_ai_template` 的弱关联，用于定位当前模板，不要求在 Prisma 中增加反向 relation；真正保证历史可复现的是 `templateSnapshot`，因为线上模板可能继续升级。读取旧草稿时必须兼容只有 `topicSnapshot` 或只有 `draftImages` 的快照。

## 七、草稿编辑器

### 7.1 小红书图文笔记

- 保持紧凑正文编辑和右侧图片栏。
- 编辑标题、钩子、正文、标签和图片顺序。
- 第一阶段正文可使用普通文本编辑；允许保留 Markdown 子集，但发布前按平台规则转换为纯文本。
- 如本期扩展图卡结构，则给 `DraftPatch` 增加可选 `slides`，并纳入差异确认；不要让 Agent 绕过确认直接写 `content_draft_slides`。

### 7.2 知乎长文

- 当 `platform === 'zhihu' && type === 'article'` 时，用 `MarkdownEditor` 替换 `Input.TextArea`。
- 默认显示编辑/预览双栏，支持标题、列表、代码块、表格、链接和图片上传。
- `body` 原样保存 Markdown，不单独保存 HTML；预览和最终发布转换在展示/发布层处理。
- 长文编辑区应获得更高的页面高度；图片素材栏保留但默认收起，避免压缩正文空间。

编辑器选择由已保存的 `platform + type` 决定，而不是让用户随意切换后造成内容解释变化。草稿类型如需修改，应通过受控转换操作完成。

## 八、DraftPatch 与平台输出

现有 `DraftPatch` 可以继续作为共享基础类型：

```ts
interface DraftPatch {
  title?: string;
  hook?: string;
  body?: string;
  tags?: string[];
  status?: DraftStatus;
  slides?: DraftSlidePatch[];
  addImages?: DraftPatchImage[];
}
```

不同平台使用不同的 Zod 输出约束：

- 小红书：允许 `hook`、简短 `body`、标签、可选 `slides` 和图片。
- 知乎：要求 `body` 为 Markdown 长文，不生成 `slides`，图片只作为正文或辅助素材。

`emit_draft_patch` 成功只表示建议到达前端。标题、正文、标签和 slides 仍需用户确认后进入表单，再由“保存”落库。

## 九、实施计划

### 阶段 A：Topic Agent 基础

1. [x] 新增 `TopicPatch`、Zod schema、`buildTopicTools` 和 `emit_topic_patch`。
2. [x] 注册 `topic_agent` 场景和默认 system prompt。
3. [x] 实现 `/api/create/topics/chat` 与 `/api/create/topics/[id]/chat`。
4. [x] 实现 `useTopicAgent`，在选题页复用助手 Drawer 和差异确认。
5. [ ] 浏览器验证新建建议、完善已有选题、重复提示和取消 patch。

### 阶段 B：选题转草稿与上下文契约

1. [x] 抽取共享 `DRAFT_PLATFORM_PROFILES`，首批只在 UI 暴露 `xhs` 和 `zhihu`。
2. [x] 给 `ContentDraft` 增加可空 `template_id` 并生成 Prisma Client。
3. [ ] 数据库结构待用户确认后执行 `pnpm prisma:push`。
4. [x] 扩展选题转草稿接口，匹配模板并保存选题/模板快照。
5. [x] 草稿详情展示来源选题和模板信息。
6. [x] 草稿 Agent 在每次运行时注入 `DraftGenerationContext`。

### 阶段 C：多形态编辑与生成

1. [x] 知乎长文接入现有 `MarkdownEditor`。
2. [x] 增加“AI 根据选题生成初稿”显式按钮，复用草稿 Agent chat 流程。
3. [x] 给草稿编辑页补齐 `hook`、`tags` 状态、保存和 DraftPatch 应用。
4. [x] 为小红书和知乎分别配置模板及结构化输出校验。
5. [x] 完善现有 DraftPatch 字段差异显示；slides patch 后置。
6. [ ] 完成数据库同步、场景绑定和浏览器端到端联调。

## 十、验收标准

- 用户可以用 Topic Agent 新建或完善选题，AI 建议不会未经确认直接写库。
- Topic Agent 可以提示标题、来源或关键词层面的重复选题。
- 用户可以从同一选题分别创建小红书图文笔记和知乎长文草稿。
- 新草稿保存创建时刻的选题快照和模板快照，之后修改选题或模板不会改写历史上下文。
- 草稿 Agent 能稳定读取选题快照，不需要用户再次复制选题内容。
- 小红书草稿保持图文编辑和图片素材流程；知乎草稿使用 Markdown 编辑/预览。
- `hook`、`tags` 等 Agent 已支持的字段可以显示、确认、编辑并保存，不再在应用 patch 时丢失。
- Agent 输出必须经过差异确认和用户保存；模型失败时不影响手工编辑。
- 旧草稿的 `generation_snapshot_json` 可以继续读取。
- `pnpm typecheck`、`pnpm lint` 和 Prisma validate/generate 通过。

## 十一、测试重点

| 测试 | 关键断言 |
|---|---|
| TopicPatch | 非法状态/来源被拒绝，已有原始想法不会被静默覆盖 |
| 去重 | 同来源、标准化同标题、关键词相似能返回候选 |
| 转草稿 | 平台映射正确，权限正确，快照完整，旧选题不被覆盖 |
| 模板匹配 | 只使用 ACTIVE 模板，显式模板必须匹配目标平台场景 |
| 上下文注入 | Topic 字段进入运行时上下文，来源中的命令不提升为 system 指令 |
| 编辑器 | `xhs/note` 与 `zhihu/article` 选择正确编辑器，Markdown 原样保存 |
| Patch 确认 | 收到 patch 不改表单，确认后只改前端 state，保存后才写库 |
| 兼容性 | 老草稿没有 `templateSnapshot` 时仍可打开和调用 Agent |
