import { NextResponse } from 'next/server';

export function getPublicOrigin(headers: Headers, requestUrl: string): string {
  const forwardedHost = headers.get('x-forwarded-host');
  const host = forwardedHost || headers.get('host');
  const forwardedProto = headers.get('x-forwarded-proto') || headers.get('x-forwarded-protocol');
  const url = new URL(requestUrl);

  if (host && host !== '0.0.0.0:3000') {
    const proto = forwardedProto || (url.protocol === 'https:' ? 'https' : 'http');
    return `${proto}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  return url.origin;
}

export function createProtectedResourceMetadata(origin: string, resourcePath = '/api/mcp') {
  return NextResponse.json({
    resource: `${origin}${resourcePath}`,
    authorization_servers: [origin],
    scopes_supported: ['read', 'write', 'admin'],
    service_documentation: 'https://github.com/NNNNzs/react.nnnnzs.cn',
    api_version: '1.0.0'
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export function createAuthorizationServerMetadata(origin: string) {
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    revocation_endpoint: `${origin}/revoke`,
    introspection_endpoint: `${origin}/introspect`,
    registration_endpoint: `${origin}/register`,
    scopes_supported: ['read', 'write', 'admin'],
    response_types_supported: ['code'],
    grant_types_supported: ['client_credentials', 'authorization_code'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    code_challenge_methods_supported: ['plain', 'S256'],
    service_documentation: 'https://github.com/NNNNzs/react.nnnnzs.cn'
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
