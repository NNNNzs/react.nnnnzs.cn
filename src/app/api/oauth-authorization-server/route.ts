import { NextRequest } from 'next/server';
import { createAuthorizationServerMetadata, getPublicOrigin } from '@/lib/mcp-oauth-metadata';

export async function GET(request: NextRequest) {
  return createAuthorizationServerMetadata(getPublicOrigin(request.headers, request.url));
}

export async function POST(request: NextRequest) {
  return GET(request);
}
