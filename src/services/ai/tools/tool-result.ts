import type { ToolResult } from './index';

export function serializeToolData(data: unknown): string {
  return JSON.stringify(data === undefined ? null : data);
}

export function serializeToolResult(result: ToolResult): string {
  return result.success
    ? serializeToolData(result.data)
    : serializeToolData({ error: result.error || '工具执行失败' });
}

export function serializeToolError(error: unknown, fallback: string): string {
  return serializeToolData({
    error: error instanceof Error ? error.message : fallback,
  });
}
