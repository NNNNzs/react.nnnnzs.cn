import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { authenticateMcpRequestEnhanced } from '@/services/mcpAuth';
import { validateTokenWithPermissions } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/auth';
import { getMcpEnabledEntries } from '@/lib/api-registry';
import { handleMcpToApi, jsonSchemaToZod } from '@/lib/mcp-adapter';
import { getAllTags } from '@/services/tag';
import { getCollectionList } from '@/services/collection';
import { getWritingStyleGuide, getReferenceDocs } from '@/lib/docs-resources';
import type { AuthUser } from '@/types/auth';

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
        // 检查是否超时（图片生成工具 120 秒，其他 15 秒）
        const method = message.method;
        const toolName = method === 'tools/call' && 'params' in message && message.params
          ? (message.params as any).name : null;
        const isSlowTool = toolName === 'image_create';
        const timeoutMs = isSlowTool ? 120_000 : 15_000;
        if (Date.now() - startTime > timeoutMs) {
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
async function createMcpServer(headers: Headers) {
  // 提前认证，获取用户权限（用于动态过滤工具列表）
  const token = getTokenFromRequest(headers);
  let user: AuthUser | null = null;
  if (token) {
    user = await validateTokenWithPermissions(token);
  }

  const server = new McpServer({
    name: "React Blog MCP",
    version: "2.0.0"
  });

  // Helper to ensure auth via Bearer Token，返回已认证用户信息（包含权限）
  const ensureAuth = async (): Promise<AuthUser> => {
    if (user) return user;
    // 先使用增强的认证函数验证身份
    const authedUser = await authenticateMcpRequestEnhanced(headers);
    const authToken = getTokenFromRequest(headers);
    if (!authToken) {
      throw new Error("Missing authentication credentials");
    }
    const authUser = await validateTokenWithPermissions(authToken);
    if (!authUser) {
      throw new Error("Failed to get user permissions");
    }
    user = authUser;
    return authUser;
  };

  // ============================
  // 从接口注册表自动注册 MCP 工具（按用户权限过滤）
  // ============================
  let allMcpEntries: Awaited<ReturnType<typeof getMcpEnabledEntries>>;
  try {
    allMcpEntries = await getMcpEnabledEntries();
  } catch (err) {
    console.error('[MCP] getMcpEnabledEntries failed:', err);
    allMcpEntries = [];
  }
  const mcpEntries = user
    ? allMcpEntries.filter(entry =>
        !entry.permissionCode || user!.permissions.includes(entry.permissionCode)
      )
    : allMcpEntries;

  for (const entry of mcpEntries) {
    const inputSchema = entry.inputSchema ? jsonSchemaToZod(entry.inputSchema) : {};

    server.registerTool(
      entry.mcpToolName!,
      {
        title: entry.name,
        description: entry.description || entry.name,
        inputSchema,
      },
      async (args) => {
        const authedUser = await ensureAuth();
        // 权限检查（功能权限 + 数据权限）统一在 handleMcpToApi 中完成
        return await handleMcpToApi(entry, args, authedUser, headers);
      }
    );
  }

  console.log(`✅ [MCP] 为用户 ${user?.account || 'unknown'} 注册了 ${mcpEntries.length}/${allMcpEntries.length} 个工具`);

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

  // Register collections as a resource
  server.registerResource(
    "collections",
    "blog://collections",
    {
      title: "Available Blog Collections",
      description: "List of all available collections with their IDs and slugs. Use this resource to check existing collections before adding articles to them. Each collection has an ID (number) and slug (string) that can be used to reference it.",
      mimeType: "application/json"
    },
    async () => {
      await ensureAuth();
      const collections = await getCollectionList({
        pageNum: 1,
        pageSize: 100
      });

      // 格式化为易读的文本
      const collectionsText = collections.record
        .map(c => `ID: ${c.id} | Slug: ${c.slug} | Title: ${c.title} | Articles: ${c.article_count}`)
        .join('\n');

      return {
        contents: [{
          uri: "blog://collections",
          mimeType: "text/plain",
          text: collectionsText
        }]
      };
    }
  );

  // Register writing style guide as a resource
  server.registerResource(
    "writing_style",
    "blog://writing_style",
    {
      title: "Blog Writing Style Guide",
      description: "Complete writing style guidelines for blog articles. MUST read before creating or updating articles to ensure the content matches the blog's authentic, conversational tone. Includes guidelines for both technical and personal reflection articles.",
      mimeType: "text/markdown"
    },
    async () => {
      await ensureAuth();
      // 动态读取写作风格指南
      const writingStyleGuide = getWritingStyleGuide();

      return {
        contents: [{
          uri: "blog://writing_style",
          mimeType: "text/markdown",
          text: writingStyleGuide
        }]
      };
    }
  );

  // 动态注册 docs/reference 目录下的所有文档作为 resources
  try {
    const refDocs = getReferenceDocs();

    for (const doc of refDocs) {
      // 跳过写作风格指南，因为已经单独注册了
      if (doc.name === 'writing-style-guide') continue;

      server.registerResource(
        doc.name,
        `blog://ref/${doc.name}`,
        {
          title: doc.name,
          description: `Reference document: ${doc.name}`,
          mimeType: "text/markdown"
        },
        async () => {
          await ensureAuth();
          return {
            contents: [{
              uri: `blog://ref/${doc.name}`,
              mimeType: "text/markdown",
              text: doc.content
            }]
          };
        }
      );
    }

    if (refDocs.length > 0) {
      console.log(`✅ [MCP] 动态注册了 ${refDocs.length} 个参考文档作为 resources`);
    }
  } catch (error) {
    console.warn('⚠️ [MCP] 动态注册参考文档失败:', error);
  }

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
            hint: "Token is invalid or expired. Please use 'Authorization: Bearer <token>' header or OAuth 2.0 authorization code flow."
          }
        },
        id: requestId
      }, { status: 401 });
    }

    const transport = new NextJsHttpTransport();

    // 传递 Headers 给 Server 工厂
    const server = await createMcpServer(request.headers);

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
            hint: "Token is invalid or expired. Please use 'Authorization: Bearer <token>' header or OAuth 2.0 authorization code flow."
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
