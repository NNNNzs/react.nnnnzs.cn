/**
 * AI 工具业务接口。
 * Agent 的运行时工具定义位于 `article-tools.ts` 等共享模块，这里仅保留
 * 可复用的业务工具契约，供具体工具和 LangChain wrapper 共享。
 */

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Tool {
  /** 工具名称（唯一标识） */
  name: string;
  /** 工具描述，用于理解工具用途 */
  description: string;
  /** 工具参数说明 */
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required?: boolean;
    };
  };
  /** 工具执行函数 */
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}
