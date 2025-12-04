import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { login } from '@/services/auth';
import { createPost, updatePost, deletePost, getPostById, getPostList, getPostByTitle } from '@/services/post';
import { getAllTags } from '@/services/tag';

/**
 * 自定义 HTTP Transport
 * 适用于无状态的请求-响应模式 (Stateless Request-Response)
 * 也可以支持流式响应 (NDJSON)
 */
class NextJsHttpTransport implements Transport {
  private _onMessage: (message: JSONRPCMessage) => void = () => {};
  private messageQueue: JSONRPCMessage[] = [];
  private resolveResponse?: (value: JSONRPCMessage[] | PromiseLike<JSONRPCMessage[]>) => void;
  private isClosed = false;

  async start() {
    // No-op for stateless transport
  }

  async close() {
    this.isClosed = true;
  }

  async send(message: JSONRPCMessage) {
    if (this.isClosed) return;
    this.messageQueue.push(message);
  }

  set onmessage(handler: (message: JSONRPCMessage) => void) {
    this._onMessage = handler;
  }

  get onmessage() {
    return this._onMessage;
  }

  /**
   * 处理单次请求
   * @param message 客户端发送的 JSON-RPC 消息
   * @returns 服务端产生的消息数组
   */
  async handleRequest(message: JSONRPCMessage): Promise<JSONRPCMessage[]> {
    // 触发 Server 处理逻辑
    this.onmessage(message);

    // 等待响应
    return new Promise((resolve) => {
      const checkQueue = () => {
        const hasResult = this.messageQueue.some(m => 'result' in m || 'error' in m);
        if (hasResult) {
          resolve([...this.messageQueue]);
          this.messageQueue = []; // Clear
        } else {
           setTimeout(checkQueue, 50);
        }
      };
      
      setTimeout(() => {
          resolve([...this.messageQueue]);
      }, 30000); // 30s timeout
      
      checkQueue();
    });
  }
}

// Factory to create server instance with auth context
function createMcpServer(headers: Headers) {
  const server = new McpServer({
    name: "React Blog MCP",
    version: "1.0.0"
  });

  // Helper to ensure auth via Headers
  const ensureAuth = async () => {
    // 优先从 Header 获取，也可以保留环境变量作为兜底
    const account = headers.get('x-mcp-account') || process.env.MCP_USER_ACCOUNT;
    const password = headers.get('x-mcp-password') || process.env.MCP_USER_PASSWORD;
    
    if (!account || !password) {
        throw new Error("Missing authentication credentials. Please provide 'x-mcp-account' and 'x-mcp-password' headers.");
    }
    
    const result = await login(account, password);
    if (!result) {
        throw new Error("Authentication failed for MCP user");
    }
    return result;
  };

  server.tool(
    "create_article",
    "Create a new blog article",
    {
      title: z.string().describe("Article title"),
      content: z.string().describe("Article content (Markdown)"),
      category: z.string().optional().describe("Article category"),
      tags: z.string().optional().describe("Comma separated tags"),
      description: z.string().optional().describe("Short description"),
      cover: z.string().optional().describe("Cover image URL"),
      hide: z.string().optional().describe("'1' to hide, '0' to show")
    },
    async (args) => {
      await ensureAuth();
      // 处理 tags：清理空格，保持逗号分隔的字符串格式
      // createPost 会进一步处理并转换为数组或字符串
      const tagsValue = args.tags?.trim() || undefined;
      
      const postData: Partial<import('@/generated/prisma-client').TbPost> = {
        ...args,
        tags: tagsValue,
      };
      const result = await createPost(postData);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  server.tool(
    "update_article",
    "Update an existing blog article",
    {
      id: z.number().describe("Article ID"),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      tags: z.string().optional(),
      description: z.string().optional(),
      cover: z.string().optional(),
      hide: z.string().optional()
    },
    async (args) => {
      await ensureAuth();
      const { id, ...restArgs } = args;
      const data: Partial<import('@/generated/prisma-client').TbPost> = {
        ...restArgs,
        // tags 保持字符串格式，updatePost 会处理
        tags: restArgs.tags?.trim() || undefined,
      };
      const result = await updatePost(id, data);
      if (!result) return { isError: true, content: [{ type: "text", text: "Article not found" }] };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  server.tool(
      "delete_article",
      "Delete (soft delete) an article",
      { id: z.number().describe("Article ID") },
      async ({ id }) => {
          await ensureAuth();
          const success = await deletePost(id);
          return {
              content: [{ type: "text", text: success ? "Deleted successfully" : "Failed to delete" }]
          };
      }
  );

  server.tool(
      "get_article",
      "Get article details by ID or Title",
      { 
          id: z.number().optional().describe("Article ID"),
          title: z.string().optional().describe("Article Title (if ID not provided)")
      },
      async ({ id, title }) => {
          await ensureAuth();
          let result;
          if (id) {
              result = await getPostById(id);
          } else if (title) {
              result = await getPostByTitle(title);
          } else {
              return { isError: true, content: [{ type: "text", text: "Must provide id or title" }] };
          }
          
          if (!result) return { isError: true, content: [{ type: "text", text: "Not found" }] };
          return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
          };
      }
  );

  server.tool(
      "list_articles",
      "List articles with pagination and search",
      {
          pageNum: z.number().optional().describe("Page number (default 1)"),
          pageSize: z.number().optional().describe("Page size (default 10)"),
          keyword: z.string().optional().describe("Search keyword"),
          hide: z.string().optional().describe("Filter by visibility")
      },
      async (args) => {
          await ensureAuth();
          const result = await getPostList({
              pageNum: args.pageNum ?? 1,
              pageSize: args.pageSize ?? 10,
              query: args.keyword,
              hide: args.hide
          });
          return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
          };
      }
  );

  server.tool(
      "list_tags",
      "List all tags",
      {},
      async () => {
          await ensureAuth();
          const tags = await getAllTags();
          return {
              content: [{ type: "text", text: JSON.stringify(tags, null, 2) }]
          };
      }
  );
  
  return server;
}

/**
 * HTTP POST Handler for Stateless MCP
 * 接收 JSON-RPC Request，返回 JSON-RPC Response (NDJSON or Array)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const transport = new NextJsHttpTransport();
        
        // 传递 Headers 给 Server 工厂
        const server = createMcpServer(request.headers);
        
        await server.connect(transport);
        
        // 处理请求
        const responses = await transport.handleRequest(body);
        
        // 如果只有一个响应且是 JSON，直接返回
        // 如果有多个响应（如 progress），返回 NDJSON
        if (responses.length === 1) {
            return NextResponse.json(responses[0]);
        } else {
            // NDJSON format
            const ndjson = responses.map(r => JSON.stringify(r)).join('\n');
            return new Response(ndjson, {
                headers: { 'Content-Type': 'application/x-ndjson' }
            });
        }
        
    } catch (error) {
        console.error("MCP Error:", error);
        return NextResponse.json({ 
            jsonrpc: "2.0", 
            error: { code: -32603, message: "Internal error" }, 
            id: null 
        }, { status: 500 });
    }
}

/**
 * GET Handler - 可用于健康检查或简单的 Server 信息
 */
export async function GET() {
    return NextResponse.json({
        status: "active",
        protocol: "mcp",
        transport: "http-post",
        note: "Send JSON-RPC requests via POST to this endpoint."
    });
}
