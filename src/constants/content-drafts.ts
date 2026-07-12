export const DRAFT_PLATFORM_PROFILES = {
  xhs: {
    platform: 'xhs',
    type: 'note',
    label: '小红书图文笔记',
    templateSlug: 'xhs-topic-to-note',
    editor: 'note',
    templateContent: `你正在把一个选题创作成小红书图文笔记。

输出要求：
- 标题具体、有结果感，不夸大，不使用虚假数字。
- hook 用一句话说明痛点、场景或收益。
- 正文口语化、可扫描，围绕选题核心角度展开，不照搬来源全文。
- 给出 3-8 个准确标签。
- 需要修改草稿时调用 emit_draft_patch，先提交标题、hook、正文和标签；图片按用户明确要求再生成。
- 不得编造来源中没有的项目结果或数据。`,
  },
  zhihu: {
    platform: 'zhihu',
    type: 'article',
    label: '知乎长文',
    templateSlug: 'zhihu-topic-to-article',
    editor: 'markdown',
    templateContent: `你正在把一个选题创作成知乎 Markdown 长文。

输出要求：
- 标题准确表达问题与核心结论，避免营销化标题。
- 正文必须是结构完整的 Markdown，包含清晰的小标题、论证、示例和总结。
- 技术内容优先解释判断依据、实现路径和容易踩坑的地方。
- 可以使用列表、引用、代码块和表格，但不要为了格式堆砌结构。
- 不生成小红书图卡或 slides。
- 需要修改草稿时调用 emit_draft_patch，正文放入 body，标签放入 tags。
- 不得编造来源中没有的事实、数据或个人经历。`,
  },
} as const;

export type DraftPlatform = keyof typeof DRAFT_PLATFORM_PROFILES;
export type DraftPlatformProfile = typeof DRAFT_PLATFORM_PROFILES[DraftPlatform];

export const DRAFT_PLATFORMS = Object.keys(DRAFT_PLATFORM_PROFILES) as DraftPlatform[];

export function getDraftPlatformProfile(platform: string): DraftPlatformProfile | undefined {
  return DRAFT_PLATFORM_PROFILES[platform as DraftPlatform];
}
