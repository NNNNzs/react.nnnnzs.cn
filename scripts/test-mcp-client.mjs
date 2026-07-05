#!/usr/bin/env node

/**
 * MCP 测试客户端
 *
 * 用法：
 *   node scripts/test-mcp-client.mjs                              # 列出所有有 token 的用户
 *   node scripts/test-mcp-client.mjs <account>                    # 按 account 查 LongTermToken 测试
 *   node scripts/test-mcp-client.mjs <account> --token <token>    # 直接用 token 测试
 *
 * 示例：
 *   node scripts/test-mcp-client.mjs
 *   node scripts/test-mcp-client.mjs NNNNzs --token LTK_xxx
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.env.MCP_TEST_CLIENT_TSX) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        MCP_TEST_CLIENT_TSX: '1',
      },
    },
  );

  if (result.error) {
    console.error(result.error);
  }

  process.exit(result.status ?? 1);
}

const { createScriptPrismaClient } = await import('./prisma-client.ts');
const prisma = createScriptPrismaClient();
const BASE_URL = process.env.MCP_BASE_URL || "http://localhost:3000";

/**
 * 发送 MCP JSON-RPC 请求
 */
async function mcpRequest(token, method, params = {}) {
  const id = Date.now();
  const body = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };

  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    return { ok: false, error: data.error };
  }

  return { ok: true, data };
}

/**
 * 获取用户的有效 LongTermToken
 */
async function getUserToken(account) {
  const user = await prisma.tbUser.findFirst({
    where: { account },
    select: { id: true, account: true, nickname: true },
  });

  if (!user) return null;

  const tokenRecord = await prisma.longTermToken.findFirst({
    where: {
      userId: user.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  return tokenRecord ? { user, token: tokenRecord.token } : null;
}

/**
 * 列出所有有 token 的用户
 */
async function listAllUsers() {
  const tokens = await prisma.longTermToken.findMany({
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      token: true,
      description: true,
      user: {
        select: { id: true, account: true, nickname: true },
      },
    },
    orderBy: { userId: "asc" },
  });

  if (tokens.length === 0) {
    console.log("没有找到有效的 LongTermToken");
    return;
  }

  console.log(`\n找到 ${tokens.length} 个有效 Token：\n`);

  for (const t of tokens) {
    const { user } = t;
    const shortToken = t.token.slice(0, 12) + "...";
    console.log(`  ${user.account} (${user.nickname})`);
    console.log(`    Token: ${shortToken}`);
    console.log(`    描述: ${t.description || "-"}`);

    // 获取该用户的工具列表
    const result = await mcpRequest(t.token, "tools/list");
    const rData = result.data?.result || result.data;
    if (result.ok && rData?.tools) {
      console.log(`    工具数: ${rData.tools.length}`);
      for (const tool of rData.tools) {
        console.log(`      - ${tool.name}: ${tool.description?.slice(0, 50) || "无描述"}`);
      }
    } else {
      console.log(`    获取工具列表失败: ${result.error?.message || "未知错误"}`);
    }
    console.log();
  }
}

/**
 * 测试指定用户的 MCP 调用
 */
async function testUser(account, tokenArg) {
  console.log(`\n测试用户: ${account}\n`);

  let user, token;

  if (tokenArg) {
    // 直接使用传入的 token
    token = tokenArg;
    const u = await prisma.tbUser.findFirst({
      where: { account },
      select: { id: true, account: true, nickname: true },
    });
    user = u || { account, nickname: account };
  } else {
    const userInfo = await getUserToken(account);
    if (!userInfo) {
      console.error(`用户 "${account}" 不存在或没有有效的 LongTermToken，请使用 --token 参数直接传入 token`);
      console.error(`用法: node scripts/test-mcp-client.mjs ${account} --token <token>`);
      process.exit(1);
    }
    user = userInfo.user;
    token = userInfo.token;
  }

  console.log(`用户: ${user.nickname} (${user.account})`);
  console.log(`Token: ${token.slice(0, 12)}...`);

  // 1. 获取工具列表
  console.log("\n--- 工具列表 ---");
  const toolsResult = await mcpRequest(token, "tools/list");
  if (!toolsResult.ok) {
    console.error(`获取工具列表失败: ${toolsResult.error?.message}`);
    process.exit(1);
  }

  // tools/list 响应: { result: { tools: [...] } }
  const resultData = toolsResult.data?.result || toolsResult.data;
  const tools = resultData?.tools || [];
  console.log(`共 ${tools.length} 个工具:\n`);
  if (tools.length === 0) {
    console.log("  (调试) 原始响应:", JSON.stringify(toolsResult.data, null, 2).slice(0, 500));
  }
  for (const tool of tools) {
    console.log(`  ${tool.name}`);
    console.log(`    描述: ${tool.description || "-"}`);
    const params = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];
    const paramList = Object.entries(params)
      .map(([k, v]) => `${k}: ${v.type}${required.includes(k) ? " (必填)" : ""}`)
      .join(", ");
    console.log(`    参数: ${paramList || "无"}`);
    console.log();
  }

  // 2. 尝试调用 list_articles（最安全的只读接口）
  const listTool = tools.find((t) => t.name === "list_articles");
  if (listTool) {
    console.log("--- 调用 list_articles ---");
    const callResult = await mcpRequest(token, "tools/call", {
      name: "list_articles",
      arguments: { pageNum: 1, pageSize: 3 },
    });

    if (callResult.ok) {
      const callData = callResult.data?.result || callResult.data;
      const content = callData?.content?.[0]?.text || "";
      try {
        const parsed = JSON.parse(content);
        console.log(`  成功! 共 ${parsed.total || 0} 篇文章`);
        if (parsed.record?.length) {
          for (const article of parsed.record.slice(0, 3)) {
            console.log(`    - [${article.id}] ${article.title}`);
          }
        }
      } catch {
        console.log(`  成功! 响应: ${content.slice(0, 200)}`);
      }
    } else {
      console.error(`  失败: ${callResult.error?.message}`);
    }
  }

  // 3. 尝试调用一个可能没有权限的工具（如 get_article）
  const getTool = tools.find((t) => t.name === "get_article");
  if (getTool) {
    console.log("\n--- 调用 get_article(id: 1) ---");
    const callResult = await mcpRequest(token, "tools/call", {
      name: "get_article",
      arguments: { id: 1 },
    });

    if (callResult.ok) {
      const callData = callResult.data?.result || callResult.data;
      const content = callData?.content?.[0]?.text || "";
      try {
        const parsed = JSON.parse(content);
        console.log(`  成功! 标题: ${parsed.title || "-"}`);
      } catch {
        console.log(`  成功! 响应: ${content.slice(0, 200)}`);
      }
    } else {
      console.error(`  失败: ${callResult.error?.message}`);
    }
  }

  console.log("\n测试完成");
}

// 主入口
async function main() {
  const args = process.argv.slice(2);
  const tokenIdx = args.indexOf("--token");
  const tokenArg = tokenIdx !== -1 && args[tokenIdx + 1] ? args[tokenIdx + 1] : null;
  const account = args.filter(a => a !== "--token" && a !== tokenArg)[0] || null;

  try {
    if (!account) {
      await listAllUsers();
    } else {
      await testUser(account, tokenArg);
    }
  } catch (err) {
    console.error("出错:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
