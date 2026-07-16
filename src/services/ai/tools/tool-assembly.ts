import type { StructuredTool } from '@langchain/core/tools';

export function assembleAgentTools(
  ...groups: ReadonlyArray<ReadonlyArray<StructuredTool>>
): StructuredTool[] {
  const tools = groups.flat();
  const names = new Set<string>();

  for (const currentTool of tools) {
    if (names.has(currentTool.name)) {
      throw new Error(`Agent 工具名称重复：${currentTool.name}`);
    }
    names.add(currentTool.name);
  }

  return tools;
}

/**
 * 数据库里可能仍保存着旧版系统模板。装配切换期间在运行时统一旧工具名，
 * 避免提示词和实际白名单短暂错位；模板完成同步后可移除此兼容层。
 */
export function normalizeLegacyAgentToolNames(content: string): string {
  return content
    .replace(/\bsearch_posts_meta\b/g, 'search_posts')
    .replace(/\bget_draft\b/g, 'get_current_draft')
    .replace(/\bget_topic\b/g, 'get_current_topic');
}
