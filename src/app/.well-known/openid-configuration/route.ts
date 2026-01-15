/**
 * OpenID Connect Discovery - 拒绝自动发现
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    error: 'unsupported',
    error_description: 'OpenID Connect not available'
  }, {
    status: 404,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export async function POST() {
  return GET();
}
