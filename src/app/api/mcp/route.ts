import { NextRequest, NextResponse } from 'next/server';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequestEnhanced } from '@/services/mcpAuth';
import { validateTokenWithPermissions } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/auth';
import { getMcpEnabledEntries } from '@/lib/api-registry';
import { handleMcpToApi, jsonSchemaToZod } from '@/lib/mcp-adapter';
import { getAllTags } from '@/services/tag';
import { getCollectionList } from '@/services/collection';
import { getPublicOrigin } from '@/lib/mcp-oauth-metadata';
import { registerPromptSkillResources } from '@/services/mcp/register-prompt-skill-resources';
import type { AuthUser } from '@/types/auth';

function createMcpAuthErrorResponse(request: NextRequest, requestId: string | number | null) {
  const resourceMetadataUrl = `${getPublicOrigin(request.headers, request.url)}/.well-known/oauth-protected-resource`;

  return NextResponse.json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Authentication failed",
      data: {
        hint: "Provide Authorization: Bearer <token>, or start OAuth discovery from the resource_metadata URL.",
        resource_metadata: resourceMetadataUrl,
      }
    },
    id: requestId
  }, {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
      'Access-Control-Expose-Headers': 'WWW-Authenticate',
      'Cache-Control': 'no-store',
    }
  });
}

function methodNotAllowed() {
  return NextResponse.json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }, {
    status: 405,
    headers: {
      Allow: 'POST',
      'Cache-Control': 'no-store',
    }
  });
}

function withStreamableHttpHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  if (!headers.has('accept')) {
    headers.set('accept', 'application/json, text/event-stream');
  }
  if (!headers.has('mcp-protocol-version')) {
    headers.set('mcp-protocol-version', '2025-06-18');
  }

  return new Request(request.url, {
    method: request.method,
    headers,
  });
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
    await authenticateMcpRequestEnhanced(headers);
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

  registerPromptSkillResources(server, ensureAuth);

  server.registerResource(
    "image_generation_job",
    new ResourceTemplate("blog://image-generation-jobs/{jobId}", { list: undefined }),
    {
      title: "Image Generation Job Status",
      description: "Read the status of an async image generation job by jobId. The generate_image tool returns the matching resourceUri.",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const authedUser = await ensureAuth();
      const rawJobId = variables.jobId;
      const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;

      if (!jobId) {
        throw new Error("Missing image generation jobId");
      }

      const { getImageGenerationJob } = await import('@/services/image-gen-job');
      const job = await getImageGenerationJob(jobId, authedUser);

      if (!job) {
        throw new Error("Image generation job not found or not accessible");
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(job, null, 2)
        }]
      };
    }
  );

  server.registerResource(
    "tts_job",
    new ResourceTemplate("blog://tts-jobs/{jobId}", { list: undefined }),
    {
      title: "TTS Job Status",
      description: "Read the status of an async TTS speech synthesis job by jobId. The synthesize_speech tool returns the matching resourceUri.",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const authedUser = await ensureAuth();
      const rawJobId = variables.jobId;
      const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;

      if (!jobId) {
        throw new Error("Missing TTS jobId");
      }

      const { getTTSJob } = await import('@/services/tts-job');
      const job = await getTTSJob(jobId, authedUser);

      if (!job) {
        throw new Error("TTS job not found or not accessible");
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(job, null, 2)
        }]
      };
    }
  );

  return server;
}

/**
 * Streamable HTTP POST Handler for MCP
 * 接收 JSON-RPC Request，返回 application/json 或 text/event-stream。
 */
export async function POST(request: NextRequest) {
  let requestId: string | number | null = null;
  let method = 'unknown';
  let body: unknown = null;
  
  try {
    body = await request.json();
    requestId = typeof body === 'object' && body !== null && 'id' in body
      ? (body as { id?: string | number | null }).id ?? null
      : null;
    method = typeof body === 'object' && body !== null && 'method' in body
      ? String((body as { method?: unknown }).method || 'unknown')
      : 'unknown';
    
    // 记录请求信息（不记录敏感信息）
    console.log('📥 [MCP] 收到请求:', {
      method,
      id: requestId,
      hasParams: typeof body === 'object' && body !== null && 'params' in body
    });

    try {
      await authenticateMcpRequestEnhanced(request.headers);
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : String(authError);
      console.warn('⚠️ [MCP] 认证失败:', {
        method,
        id: requestId,
        reason: errorMessage,
        hint: 'Token 可能已过期或被删除，客户端需要重新认证'
      });
      
      return createMcpAuthErrorResponse(request, requestId);
    }

    const server = await createMcpServer(request.headers);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(withStreamableHttpHeaders(request), { parsedBody: body });
    void transport.close();
    void server.close();
    return response;

  } catch (error) {
    console.error("❌ [MCP] 处理请求时发生错误:", error);
    
    // 如果是认证错误，返回更明确的错误信息
    if (error instanceof Error && (
      error.message.includes('authentication') || 
      error.message.includes('token') ||
      error.message.includes('Invalid') ||
      error.message.includes('expired')
    )) {
      return createMcpAuthErrorResponse(request, requestId);
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
 * GET Handler
 * Streamable HTTP 规范要求 GET 要么打开 SSE，要么返回 405。
 * 本服务使用 stateless JSON response mode，不提供 standalone SSE。
 */
export async function GET(request: NextRequest) {
  if (!getTokenFromRequest(request.headers)) {
    return createMcpAuthErrorResponse(request, null);
  }
  return methodNotAllowed();
}

export async function DELETE(request: NextRequest) {
  if (!getTokenFromRequest(request.headers)) {
    return createMcpAuthErrorResponse(request, null);
  }
  return methodNotAllowed();
}
