import { NextResponse } from "next/server";

const R2_WORKER_URL =
  process.env.R2_WORKER_URL || "https://r2-file-manager.nnnnzs.workers.dev";
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";

/**
 * GET /api/r2-files?prefix=cyberpunk
 * 代理 R2 文件列表，避免前端跨域问题
 * 通过 NAS 代理（ZeroTier）访问 Cloudflare Workers
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") || "cyberpunk";

  try {
    const fetchOptions: RequestInit = {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15000),
    };

    // 如果配置了代理，使用 undici ProxyAgent
    if (PROXY_URL) {
      const { ProxyAgent } = await import("undici");
      const dispatcher = new ProxyAgent(PROXY_URL);
      (fetchOptions as Record<string, unknown>).dispatcher = dispatcher;
    }

    const res = await fetch(
      `${R2_WORKER_URL}/api/files?prefix=${encodeURIComponent(prefix + "/")}`,
      fetchOptions
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `R2 API error: ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // 过滤掉文件夹，只返回文件
    const files = (data.files || [])
      .filter((f: { isFolder?: boolean }) => !f.isFolder)
      .map((f: { key: string; size: number; lastModified: string }) => {
        const parts = f.key.split("/");
        const name = parts.length > 1 ? parts.slice(1).join("/") : f.key;
        const ext = name.split(".").pop()?.toLowerCase() || "";
        return {
          name,
          key: f.key,
          size: f.size,
          sizeHuman:
            f.size > 1024 * 1024
              ? `${(f.size / 1024 / 1024).toFixed(1)}MB`
              : `${(f.size / 1024).toFixed(0)}KB`,
          ext,
          downloadUrl: `${R2_WORKER_URL}/api/download/${f.key}`,
          lastModified: f.lastModified,
        };
      });

    return NextResponse.json({ files, total: files.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch R2 files: ${msg}` },
      { status: 500 }
    );
  }
}
