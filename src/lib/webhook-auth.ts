export function isWebhookAuthorized(authorization: string | null, expectedToken?: string) {
  if (!expectedToken || !authorization?.startsWith('Bearer ')) return false;
  return authorization.slice(7) === expectedToken;
}
