/**
 * AI 工具系统
 * 支持可扩展的工具注册和调用
 * 使用 JSON-RPC 2.0 格式进行工具调用和结果返回
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
 * JSON-RPC 请求格式
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

/**
 * JSON-RPC 响应格式
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
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
   * 使用 JSON-RPC 2.0 格式
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

**工具调用格式（JSON-RPC 2.0）：**
当你需要调用工具时，请使用以下 JSON-RPC 格式，包裹在 \`\`\`json-rpc 代码块中：

示例格式（注意：实际使用时不要包含注释）：
\`\`\`json-rpc
{{
  "jsonrpc": "2.0",
  "method": "工具名称",
  "params": {{
    "参数名1": "参数值1",
    "参数名2": "参数值2"
  }},
  "id": 1
}}
\`\`\`

**重要说明：**
1. 必须使用标准的 JSON-RPC 2.0 格式
2. method 字段为工具名称
3. params 字段为参数对象
4. id 字段可以是任意数字或字符串
5. 必须包裹在 \`\`\`json-rpc 代码块中
6. 只有在需要查询知识库或执行特定操作时才调用工具
7. 如果问题可以通过通用知识回答，不需要调用工具`;
  }
}

/**
 * 全局工具注册表实例
 */
export const toolRegistry = new ToolRegistry();

/**
 * 解析工具调用（JSON-RPC 格式）
 * 从文本中提取 ```json-rpc 代码块中的 JSON-RPC 调用
 * @param text 包含工具调用的文本
 * @returns 工具调用信息数组
 */
export function parseToolCalls(text: string): Array<{
  name: string;
  args: Record<string, unknown>;
  id: string | number;
  fullMatch: string;
}> {
  const toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    id: string | number;
    fullMatch: string;
  }> = [];

  // 匹配 ```json-rpc ... ``` 代码块
  const jsonRpcRegex = /```json-rpc\s*([\s\S]*?)```/g;
  let match;

  while ((match = jsonRpcRegex.exec(text)) !== null) {
    const [fullMatch, jsonContent] = match;
    try {
      const jsonRpcRequest = JSON.parse(jsonContent.trim()) as JsonRpcRequest;
      
      // 验证 JSON-RPC 格式
      if (jsonRpcRequest.jsonrpc !== '2.0') {
        console.error('❌ 无效的 JSON-RPC 版本:', jsonRpcRequest.jsonrpc);
        continue;
      }
      
      if (!jsonRpcRequest.method) {
        console.error('❌ JSON-RPC 请求缺少 method 字段');
        continue;
      }
      
      toolCalls.push({
        name: jsonRpcRequest.method,
        args: jsonRpcRequest.params || {},
        id: jsonRpcRequest.id,
        fullMatch,
      });
    } catch (error) {
      console.error('❌ 解析 JSON-RPC 请求失败:', error);
      console.error('JSON 内容:', jsonContent);
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
  id: string | number;
}): Promise<{
  result: ToolResult;
  id: string | number;
}> {
  const tool = toolRegistry.get(toolCall.name);
  if (!tool) {
    return {
      result: {
        success: false,
        error: `工具 ${toolCall.name} 不存在`,
      },
      id: toolCall.id,
    };
  }

  try {
    // 验证必需参数
    for (const [key, param] of Object.entries(tool.parameters)) {
      if (param.required !== false && !(key in toolCall.args)) {
        return {
          result: {
            success: false,
            error: `缺少必需参数: ${key}`,
          },
          id: toolCall.id,
        };
      }
    }

    // 执行工具
    console.log(`🔧 执行工具: ${toolCall.name}`, toolCall.args);
    const result = await tool.execute(toolCall.args);
    console.log(`✅ 工具执行完成: ${toolCall.name}`, result.success ? '成功' : '失败');
    return {
      result,
      id: toolCall.id,
    };
  } catch (error) {
    console.error(`❌ 工具执行错误 (${toolCall.name}):`, error);
    return {
      result: {
        success: false,
        error: error instanceof Error ? error.message : '工具执行失败',
      },
      id: toolCall.id,
    };
  }
}

/**
 * 格式化 JSON-RPC 响应
 * @param id 请求ID
 * @param result 工具执行结果
 * @returns JSON-RPC 格式的响应
 */
export function formatJsonRpcResponse(
  id: string | number,
  result: ToolResult
): JsonRpcResponse {
  if (result.success) {
    return {
      jsonrpc: '2.0',
      result: result.data,
      id,
    };
  } else {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: result.error || '工具执行失败',
      },
      id,
    };
  }
}
