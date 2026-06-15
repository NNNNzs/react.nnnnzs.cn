# AI 工具系统

Chat Agent 使用 LangGraph + LangChain 原生 function calling。工具分为两层：

- `search-*.ts`：业务工具，封装数据库、向量检索、合集查询等可复用逻辑。
- `langchain-tools.ts`：LangChain `tool()` wrapper，使用 zod schema 暴露给 Agent。

## 当前工具

| 工具 | 用途 |
| --- | --- |
| `search_articles` | RAG 检索工具，通过向量相似度搜索相关文章 |
| `search_posts_meta` | 按时间、标签、分类、热度等维度查询文章列表 |
| `search_collection` | 在指定文章合集中查找文章 |
| `github_search` | 搜索 GitHub 仓库、Issue/PR、用户仓库和 Star 列表 |

## 超时与可观测性

- `search_articles` 依赖 embedding 服务和 Qdrant，业务层分别设置 8 秒超时，避免向量链路拖住整条聊天流。
- `search_posts_meta` 内部请求 `/api/post/query`，设置 8 秒超时。
- `github_search` 通过 `proxyFetch` 访问 GitHub API，设置 10 秒超时，并复用 `GITHUB_PROXY_URL` / `HTTPS_PROXY` / `HTTP_PROXY`。
- Chat Agent 会把工具调用的 `toolName`、`startedAt`、`endedAt`、`durationMs` 写入聊天消息 `metadata.reactLoops[].steps[]` 和 `metadata.reactTimeline[].steps[]`，用于后续排查慢工具。

## 添加新工具

1. 在 `src/services/ai/tools/` 下创建业务工具，例如 `my-tool.ts`。
2. 实现 `Tool` 接口，返回 `{ success, data?, error? }`。
3. 在 `langchain-tools.ts` 中用 LangChain `tool()` 包装业务工具，并定义 zod schema。
4. 将 wrapper 加入 `chatTools` 数组。
5. 对任何外部网络、向量数据库或内部 HTTP 请求设置业务级超时，避免工具永久等待。

示例：

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { myTool } from './my-tool';

export const lcMyTool = tool(
  async ({ keyword }) => {
    const result = await myTool.execute({ keyword });
    if (!result.success) return JSON.stringify({ error: result.error });
    return JSON.stringify(result.data);
  },
  {
    name: 'my_tool',
    description: '工具用途说明，帮助模型判断何时调用。',
    schema: z.object({
      keyword: z.string().describe('查询关键词'),
    }),
  },
);
```

## 注意事项

- 新工具优先复用服务层能力，不要在 wrapper 中堆业务逻辑。
- 参数校验放在 zod schema 和业务工具内部两层处理。
- 工具结果应尽量返回结构化 JSON，便于 Agent 基于结果继续回答。
- Chat Agent 主入口位于 `src/services/ai/chat-agent`，不要再新增 JSON-RPC 或手写 ReAct 解析逻辑。
