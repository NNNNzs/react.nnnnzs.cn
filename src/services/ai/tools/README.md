# AI 工具系统

## 概述

AI 工具系统支持可扩展的工具注册和调用，使用 ReAct 模式让 AI 模型自主决定是否调用工具。工具调用使用 XML 标签格式，方便解析。

## 工具调用流程

1. **AI 分析用户问题**：AI 根据用户问题判断是否需要调用工具
2. **工具调用**：AI 使用 XML 标签格式调用工具
   ```xml
   <tool_call name="工具名称">
   {
     "参数名1": "参数值1",
     "参数名2": "参数值2"
   }
   </tool_call>
   ```
3. **工具执行**：系统解析工具调用，执行工具，返回结果
4. **结果处理**：工具结果以 XML 标签格式返回给 AI
   ```xml
   <tool_result name="工具名称">
   结果内容（JSON 格式）
   </tool_result>
   ```
5. **继续对话**：AI 基于工具结果继续回答用户问题

## 添加新工具

### 1. 创建工具文件

在 `src/services/ai/tools/` 目录下创建新工具文件，例如 `my-tool.ts`：

```typescript
import type { Tool, ToolResult } from './index';

export const myTool: Tool = {
  name: 'my_tool',
  description: '工具描述，说明工具的用途和使用场景',
  parameters: {
    param1: {
      type: 'string',
      description: '参数1的描述',
      required: true,
    },
    param2: {
      type: 'number',
      description: '参数2的描述',
      required: false,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const param1 = args.param1 as string;
      const param2 = (args.param2 as number) || 0;

      // 参数验证
      if (!param1) {
        return {
          success: false,
          error: 'param1 不能为空',
        };
      }

      // 执行工具逻辑
      const result = await doSomething(param1, param2);

      return {
        success: true,
        data: {
          result: result,
        },
      };
    } catch (error) {
      console.error('工具执行错误:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '工具执行失败',
      };
    }
  },
};
```

### 2. 注册工具

在 `src/app/api/chat/route.ts` 中注册工具：

```typescript
import { myTool } from '@/services/ai/tools/my-tool';

// 注册工具
toolRegistry.register(myTool);
```

### 3. 工具结果格式化（可选）

如果工具结果需要特殊格式化（如 `search_articles` 需要转换为包含链接的上下文），可以在 `chat/route.ts` 的 ReAct 循环中添加格式化逻辑：

```typescript
// 格式化工具结果
if (toolCall.name === 'my_tool' && result.success && result.data) {
  // 自定义格式化逻辑
  const formattedResult = formatMyToolResult(result.data);
  toolResults.push(formattedResult);
} else {
  // 使用默认 XML 格式
  const toolResultXml = formatToolResult(toolCall.name, result);
  toolResults.push(toolResultXml);
}
```

## 工具接口规范

### Tool 接口

```typescript
interface Tool {
  name: string;                    // 工具名称（唯一标识，使用下划线命名）
  description: string;             // 工具描述（用于 AI 理解工具用途）
  parameters: {                    // 工具参数说明
    [key: string]: {
      type: string;                // 参数类型：'string' | 'number' | 'boolean' | 'object' | 'array'
      description: string;         // 参数描述
      required?: boolean;          // 是否必需（默认 true）
    };
  };
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}
```

### ToolResult 接口

```typescript
interface ToolResult {
  success: boolean;                // 是否成功
  data?: unknown;                 // 成功时的数据
  error?: string;                 // 失败时的错误信息
}
```

## 现有工具

### search_articles

文章搜索工具，通过向量相似度搜索相关文章。

**参数：**
- `query` (string, 必需): 搜索查询文本
- `limit` (number, 可选): 返回结果数量限制，默认为 5

**返回：**
```json
{
  "query": "搜索查询",
  "results": [
    {
      "postId": 1,
      "title": "文章标题",
      "url": "/2024/12/25/article",
      "chunks": [
        {
          "chunkIndex": 0,
          "chunkText": "文章片段内容",
          "score": 0.95
        }
      ]
    }
  ],
  "totalResults": 1
}
```

## 注意事项

1. **工具名称**：使用下划线命名（如 `search_articles`），避免使用连字符或驼峰命名
2. **参数验证**：工具执行函数必须验证参数类型和必需性
3. **错误处理**：工具执行失败时返回 `{ success: false, error: string }`
4. **工具描述**：描述要清晰，帮助 AI 理解何时使用该工具
5. **ReAct 循环**：最多执行 3 轮工具调用，避免无限循环
6. **XML 标签**：工具调用和结果使用 XML 标签格式，方便解析

## 示例：添加计算器工具

```typescript
// src/services/ai/tools/calculator.ts
import type { Tool, ToolResult } from './index';

export const calculatorTool: Tool = {
  name: 'calculator',
  description: '执行数学计算。当用户需要进行数学运算时使用此工具。',
  parameters: {
    expression: {
      type: 'string',
      description: '数学表达式，例如 "2 + 2" 或 "10 * 5"',
      required: true,
    },
  },
  async execute(args): Promise<ToolResult> {
    try {
      const expression = args.expression as string;
      
      // 简单的安全验证（实际应用中需要更严格的验证）
      if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        return {
          success: false,
          error: '表达式包含非法字符',
        };
      }

      // 执行计算（注意：实际应用中应使用更安全的计算方式）
      const result = eval(expression);

      return {
        success: true,
        data: {
          expression,
          result,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '计算失败',
      };
    }
  },
};
```

然后在 `chat/route.ts` 中注册：

```typescript
import { calculatorTool } from '@/services/ai/tools/calculator';

toolRegistry.register(calculatorTool);
```
