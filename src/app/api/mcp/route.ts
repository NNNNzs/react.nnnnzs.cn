import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { authenticateMcpRequestEnhanced } from '@/services/mcpAuth';
import { createPost, updatePost, deletePost, getPostById, getPostList, getPostByTitle } from '@/services/post';
import { getAllTags } from '@/services/tag';

/**
 * 自定义 HTTP Transport
 * 适用于无状态的请求-响应模式 (Stateless Request-Response)
 * 也可以支持流式响应 (NDJSON)
 */
class NextJsHttpTransport implements Transport {
  private _onMessage: (message: JSONRPCMessage) => void = () => { };
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
    this.messageQueue = []; // 清空之前的消息
    
    // 检查是否为 notification（没有 id 字段）
    const isNotification = !('id' in message) || message.id === null || message.id === undefined;
    
    // 触发 Server 处理逻辑
    this.onmessage(message);

    // 如果是 notification，立即返回空数组（不需要响应）
    if (isNotification) {
      return [];
    }

    // 对于有 ID 的请求，等待响应
    return new Promise((resolve) => {
      const requestId = 'id' in message ? message.id : null;
      const startTime = Date.now();
      
      const checkQueue = () => {
        // 检查是否超时（5秒）
        if (Date.now() - startTime > 5000) {
          console.warn('⚠️ MCP request timeout:', requestId);
          if (this.messageQueue.length > 0) {
            resolve([...this.messageQueue]);
          } else {
            // 返回一个错误响应
            resolve([{
              jsonrpc: "2.0" as const,
              id: requestId as string | number,
              error: { code: -32603, message: "Request timeout" }
            }]);
          }
          this.messageQueue = [];
          return;
        }
        
        // 检查是否有匹配的响应
        const hasMatchingResponse = this.messageQueue.some(m => {
          // 检查是否是响应消息（有 result 或 error）
          if ('result' in m || 'error' in m) {
            // 如果请求有 ID，检查响应的 ID 是否匹配
            if (requestId !== null && requestId !== undefined) {
              return 'id' in m && m.id === requestId;
            }
            return false;
          }
          return false;
        });
        
        if (hasMatchingResponse || this.messageQueue.length > 0) {
          // 多等待一点时间，确保所有相关消息都已接收
          setTimeout(() => {
            resolve([...this.messageQueue]);
            this.messageQueue = [];
          }, 10);
        } else {
          setTimeout(checkQueue, 10);
        }
      };

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

  // Helper to ensure auth via Bearer Token，返回已认证用户信息
  const ensureAuth = async () => {
    // 使用增强的认证函数，支持多种认证方式
    return await authenticateMcpRequestEnhanced(headers);
  };

  server.registerTool(
    "create_article",
    {
      title: "Create article",
      description: "Create a new blog article. First read the 'blog://tags' resource to check existing tags, then use matching tags or create new ones.",
      inputSchema: {
        title: z.string().describe("Article title"),
        content: z.string().describe("Article content (Markdown)"),
        category: z.string().optional().describe("Article category"),
        tags: z.string().optional().describe("Comma-separated tags. Check 'blog://tags' resource first for existing tags, then use matching ones or create new custom tags"),
        description: z.string().optional().describe("Short description"),
        cover: z.string().optional().describe("Cover image URL"),
        hide: z.string().optional().describe("'1' to hide, '0' to show")
      }
    },
    async (args) => {
      const user = await ensureAuth();
      // 处理 tags：清理空格，保持逗号分隔的字符串格式
      // createPost 会进一步处理并转换为数组或字符串
      const tagsValue = args.tags?.trim() || undefined;

      const postData: Partial<import('@/generated/prisma-client').TbPost> = {
        ...args,
        tags: tagsValue,
        // 使用 MCP 登录用户作为创建人
        created_by: user.id,
      };
      const result = await createPost(postData);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  server.registerTool(
    "update_article",
    {
      title: "Update article",
      description: "Update an existing blog article",
      inputSchema: {
        id: z.number().describe("Article ID"),
        title: z.string().optional(),
        content: z.string().optional(),
        category: z.string().optional(),
        tags: z.string().optional(),
        description: z.string().optional(),
        cover: z.string().optional(),
        hide: z.string().optional()
      }
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

  server.registerTool(
    "delete_article",
    {
      title: "Delete article",
      description: "Delete (soft delete) an article",
      inputSchema: {
        id: z.number().describe("Article ID")
      }
    },
    async ({ id }) => {
      await ensureAuth();
      const success = await deletePost(id);
      return {
        content: [{ type: "text", text: success ? "Deleted successfully" : "Failed to delete" }]
      };
    }
  );

  server.registerTool(
    "get_article",
    {
      title: "Get article",
      description: "Get article details by ID or Title",
      inputSchema: {
        id: z.number().optional().describe("Article ID"),
        title: z.string().optional().describe("Article Title (if ID not provided)")
      }
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

  server.registerTool(
    "list_articles",
    {
      title: "List articles",
      description: "List articles with pagination and search",
      inputSchema: {
        pageNum: z.number().optional().describe("Page number (default 1)"),
        pageSize: z.number().optional().describe("Page size (default 10)"),
        keyword: z.string().optional().describe("Search keyword"),
        hide: z.string().optional().describe("Filter by visibility")
      }
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

  // Register tags as a resource
  server.registerResource(
    "tags",
    "blog://tags",
    {
      title: "Available Blog Tags",
      description: "List of all available tags with usage counts. Use this resource to check existing tags before creating new ones.",
      mimeType: "application/json"
    },
    async () => {
      await ensureAuth();
      const tags = await getAllTags();
      const tagsString = tags.map(tag => tag[0]).join(',');
      return {
        contents: [{
          uri: "blog://tags",
          mimeType: "application/json",
          text: tagsString
        }]
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
  let requestId: string | number | null = null;
  let method = 'unknown';
  let isNotification = false;
  
  try {
    const body = await request.json();
    requestId = 'id' in body ? body.id : null;
    method = 'method' in body ? body.method : 'unknown';
    isNotification = !('id' in body) || body.id === null || body.id === undefined;
    
    // 记录请求信息（不记录敏感信息）
    console.log('📥 [MCP] 收到请求:', {
      method,
      id: requestId,
      isNotification,
      hasParams: 'params' in body
    });

    // 对于所有请求（包括 notification），都验证 token
    // 如果 token 无效，立即返回错误，让客户端知道需要重新认证
    try {
      await authenticateMcpRequestEnhanced(request.headers);
    } catch (authError) {
      // 认证失败是预期的错误（token 过期、被删除等），使用 warn 级别
      const errorMessage = authError instanceof Error ? authError.message : String(authError);
      console.warn('⚠️ [MCP] 认证失败:', {
        method,
        id: requestId,
        reason: errorMessage,
        hint: 'Token 可能已过期或被删除，客户端需要重新认证'
      });
      
      // 对于所有请求，如果认证失败，都返回错误
      // 这样客户端就知道 token 无效，需要重新认证
      return NextResponse.json({
        jsonrpc: "2.0",
        error: { 
          code: -32000,
          message: "Authentication failed",
          data: {
            hint: "Token is invalid or expired. Please re-authenticate or use /revoke to clear invalid tokens."
          }
        },
        id: requestId
      }, { status: 401 });
    }

    const transport = new NextJsHttpTransport();

    // 传递 Headers 给 Server 工厂
    const server = createMcpServer(request.headers);

    await server.connect(transport);

    // 处理请求
    const responses = await transport.handleRequest(body);

    // Notification 不需要响应，返回空数组
    if (isNotification) {
      console.log('📤 [MCP] Notification 处理完成，返回空响应');
      return NextResponse.json([]);
    }

    // 如果只有一个响应且是 JSON，直接返回
    // 如果有多个响应（如 progress），返回 NDJSON
    if (responses.length === 1) {
      const response = responses[0];
      
      // 记录响应信息
      if ('error' in response) {
        const responseId = 'id' in response ? response.id : null;
        console.log('❌ [MCP] 请求失败:', {
          id: responseId,
          error: response.error
        });
      } else {
        const responseId = 'id' in response ? response.id : null;
        console.log('✅ [MCP] 请求成功:', {
          id: responseId,
          hasResult: 'result' in response
        });
      }
      
      return NextResponse.json(response);
    } else if (responses.length === 0) {
      // 没有响应（不应该发生，但处理一下）
      console.warn('⚠️ [MCP] 请求没有生成响应');
      return NextResponse.json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "No response generated" },
        id: requestId
      }, { status: 500 });
    } else {
      // NDJSON format
      const ndjson = responses.map(r => JSON.stringify(r)).join('\n');
      return new Response(ndjson, {
        headers: { 'Content-Type': 'application/x-ndjson' }
      });
    }

  } catch (error) {
    console.error("❌ [MCP] 处理请求时发生错误:", error);
    
    // 如果是认证错误，返回更明确的错误信息
    if (error instanceof Error && (
      error.message.includes('authentication') || 
      error.message.includes('token') ||
      error.message.includes('Invalid') ||
      error.message.includes('expired')
    )) {
      return NextResponse.json({
        jsonrpc: "2.0",
        error: { 
          code: -32000,
          message: "Authentication failed",
          data: {
            hint: "Token is invalid or expired. Please re-authenticate or use /revoke to clear invalid tokens."
          }
        },
        id: requestId
      }, { status: 401 });
    }
    
    return NextResponse.json({
      jsonrpc: "2.0",
      error: { 
        code: -32603, 
        message: error instanceof Error ? error.message : "Internal error" 
      },
      id: requestId
    }, { status: 500 });
  }
}

/**
 * GET Handler - MCP 服务健康检查和基础信息
 * 注意：OAuth 2.0 元数据端点由独立的 .well-known 路由处理
 */
export async function GET() {
  // 健康检查和基础信息
  return NextResponse.json({
    status: "active",
    protocol: "mcp",
    version: "2024-11-05",
    transport: "http-post",
    authentication: "OAuth 2.0 Bearer Token",
    capabilities: {
      tools: true,
      prompts: true,
      resources: true,
      sampling: false
    },
    endpoints: {
      // MCP 端点
      mcp: "/api/mcp",
      
      // OAuth 2.0 标准发现端点（根路径）
      oauth_metadata: "/.well-known/oauth-protected-resource",
      oauth_auth_server: "/.well-known/oauth-authorization-server",
      openid_config: "/.well-known/openid-configuration",
      
      // OAuth 2.0 标准端点（根路径）
      register: "/register",
      token: "/token",
      revoke: "/revoke",
      introspect: "/introspect",
      authorize: "/authorize",
      
      // 认证端点
      login: "/api/auth/login",
      oauth_authorize: "/api/oauth/authorize"
    },
    documentation: {
      setup_guide: "https://github.com/NNNNzs/react.nnnnzs.cn/blob/main/docs/mcp_claude_code_setup.md",
      oauth_guide: "https://github.com/NNNNzs/react.nnnnzs.cn/blob/main/docs/oauth2_implementation_guide.md"
    },
    note: "Send JSON-RPC requests via POST to /api/mcp with Authorization: Bearer <token> header"
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5分钟缓存
    }
  });
}
