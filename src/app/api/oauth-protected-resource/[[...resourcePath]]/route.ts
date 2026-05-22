import { NextRequest } from 'next/server';
import { createProtectedResourceMetadata, getPublicOrigin } from '@/lib/mcp-oauth-metadata';

interface RouteContext {
  params: Promise<{
    resourcePath?: string[];
  }>;
}

async function getResourcePath(context: RouteContext) {
  const { resourcePath } = await context.params;
  return resourcePath?.length ? `/${resourcePath.join('/')}` : '/api/mcp';
}

export async function GET(request: NextRequest, context: RouteContext) {
  return createProtectedResourceMetadata(
    getPublicOrigin(request.headers, request.url),
    await getResourcePath(context)
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  return GET(request, context);
}
