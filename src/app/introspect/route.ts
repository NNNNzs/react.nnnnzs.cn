/**
 * OAuth 2.0 Token Introspection Endpoint (根路径)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth';
import { validateLongTermToken } from '@/services/token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ active: false });
    }

    // 验证普通 Token
    const user = await validateToken(token);
    if (user) {
      return NextResponse.json({
        active: true,
        username: user.account,
        scope: 'read write',
        client_id: `mcp-client-${user.id}`,
        token_type: 'Bearer'
      });
    }

    // 验证长期 Token
    const userId = await validateLongTermToken(token);
    if (userId) {
      return NextResponse.json({
        active: true,
        username: `user-${userId}`,
        scope: 'read write',
        client_id: `mcp-client-${userId}`,
        token_type: 'Bearer'
      });
    }

    return NextResponse.json({ active: false });
  } catch (error) {
    return NextResponse.json({ active: false });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/introspect',
    description: 'OAuth 2.0 Token Introspection',
    method: 'POST'
  });
}
