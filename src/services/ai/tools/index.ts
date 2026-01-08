/**
 * AI 工具系统
 * 支持可扩展的工具注册和调用
 * 使用 XML 标签格式进行工具调用和结果返回
 */

/**
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * 工具定义接口
 */
export interface Tool {
  /** 工具名称（唯一标识） */
  name: string;
  /** 工具描述（用于 AI 理解工具用途） */
  description: string;
  /** 工具参数说明（用于 AI 理解如何调用） */
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

/**
 * 工具注册表
 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * 注册工具
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`⚠️ 工具 ${tool.name} 已存在，将被覆盖`);
    }
    this.tools.set(tool.name, tool);
    console.log(`✅ 工具 ${tool.name} 已注册`);
  }

  /**
   * 获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取工具列表描述（用于 AI 理解可用工具）
   */
  getToolsDescription(): string {
    const tools = this.getAll();
    if (tools.length === 0) {
      return '当前没有可用的工具。';
    }

    const descriptions = tools.map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(([key, param]) => {
          const required = param.required !== false ? '（必需）' : '（可选）';
          return `  - ${key} (${param.type})${required}: ${param.description}`;
        })
        .join('\n');

      return `**${tool.name}**
描述: ${tool.description}
参数:
${params || '  无参数'}`;
    });

    return `可用工具列表：

${descriptions.join('\n\n')}

**工具调用格式：**
当你需要调用工具时，请使用以下 XML 标签格式：

<tool_call name="工具名称">
{
  "参数名1": "参数值1",
  "参数名2": "参数值2"
}
</tool_call>

**重要说明：**
1. 工具调用必须使用 JSON 格式传递参数
2. 参数值必须是有效的 JSON 类型（字符串、数字、布尔值、对象、数组）
3. 只有在需要查询知识库或执行特定操作时才调用工具
4. 如果问题可以通过通用知识回答，不需要调用工具`;
  }
}

/**
 * 全局工具注册表实例
 */
export const toolRegistry = new ToolRegistry();

/**
 * 解析工具调用
 * @param text 包含工具调用的文本
 * @returns 工具调用信息数组
 */
export function parseToolCalls(text: string): Array<{
  name: string;
  args: Record<string, unknown>;
  fullMatch: string;
}> {
  const toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    fullMatch: string;
  }> = [];

  // 匹配 <tool_call name="工具名">参数JSON</tool_call>
  const toolCallRegex = /<tool_call\s+name="([^"]+)">\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let match;

  while ((match = toolCallRegex.exec(text)) !== null) {
    const [, name, argsJson] = match;
    try {
      const args = JSON.parse(argsJson.trim());
      toolCalls.push({
        name,
        args,
        fullMatch: match[0],
      });
    } catch (error) {
      console.error(`❌ 解析工具调用参数失败 (${name}):`, error);
      console.error('参数 JSON:', argsJson);
    }
  }

  return toolCalls;
}

/**
 * 执行工具调用
 * @param toolCall 工具调用信息
 * @returns 工具执行结果
 */
export async function executeToolCall(toolCall: {
  name: string;
  args: Record<string, unknown>;
}): Promise<ToolResult> {
  const tool = toolRegistry.get(toolCall.name);
  if (!tool) {
    return {
      success: false,
      error: `工具 ${toolCall.name} 不存在`,
    };
  }

  try {
    // 验证必需参数
    for (const [key, param] of Object.entries(tool.parameters)) {
      if (param.required !== false && !(key in toolCall.args)) {
        return {
          success: false,
          error: `缺少必需参数: ${key}`,
        };
      }
    }

    // 执行工具
    console.log(`🔧 执行工具: ${toolCall.name}`, toolCall.args);
    const result = await tool.execute(toolCall.args);
    console.log(`✅ 工具执行完成: ${toolCall.name}`, result.success ? '成功' : '失败');
    return result;
  } catch (error) {
    console.error(`❌ 工具执行错误 (${toolCall.name}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '工具执行失败',
    };
  }
}

/**
 * 生成工具结果 XML 标签
 * @param toolName 工具名称
 * @param result 工具执行结果
 * @returns XML 格式的工具结果
 */
export function formatToolResult(toolName: string, result: ToolResult): string {
  const resultContent = result.success
    ? JSON.stringify(result.data, null, 2)
    : `错误: ${result.error}`;

  return `<tool_result name="${toolName}">
${resultContent}
</tool_result>`;
}
