/**
 * 草稿 patch 类型定义
 *
 * 由 create-agent 的 emit_draft_patch 工具产出，通过 SSE patch 事件下发，
 * 前端先展示差异并等待用户确认，再应用到草稿表单 state。
 *
 * 后端（agent 工具）与前端（待确认建议）共享此类型。
 */

export interface DraftPatchImage {
  /** 已入库的素材 ID（用户确认后 attach 到草稿需要） */
  assetId?: number;
  /** 图片 CDN URL */
  imageUrl: string;
  /** 图片备注/标题 */
  title?: string;
  /** 分组名，如 cover */
  group?: string;
}

/** 图文草稿中的一张图卡计划；prompt 在用户确认后持久化到 content_draft_slides。 */
export interface DraftPatchSlide {
  title?: string;
  bullets?: string[];
  prompt: string;
}

export interface DraftPatch {
  /** 新标题 */
  title?: string;
  /** 钩子文案 */
  hook?: string;
  /** 正文（Markdown） */
  body?: string;
  /** 标签数组 */
  tags?: string[];
  /** 草稿状态 */
  status?: 'DRAFT' | 'ASSET_PENDING' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
  /** 要追加到草稿的图片 */
  addImages?: DraftPatchImage[];
  /** 图卡文案与图片提示词计划，不会直接触发图片生成。 */
  slides?: DraftPatchSlide[];
}
