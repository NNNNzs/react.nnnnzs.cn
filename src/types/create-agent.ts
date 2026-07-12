/**
 * 草稿编辑器发送给创作 Agent 的实时表单快照。
 * 仅在它与数据库草稿不同的时候作为本轮创作上下文使用。
 */
export interface CreateAgentPageContext {
  title: string;
  hook: string;
  body: string;
  tags: string[];
  type: string;
  status: string;
}
