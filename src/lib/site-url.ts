const DEFAULT_SITE_URL = 'https://www.nnnnzs.cn';

function isLocalUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = configuredUrl
    && !(process.env.NODE_ENV === 'production' && isLocalUrl(configuredUrl))
    ? configuredUrl
    : DEFAULT_SITE_URL;
  return siteUrl.replace(/\/+$/, '');
}

export function toAbsoluteSiteUrl(path: string): string {
  return new URL(path, `${getSiteUrl()}/`).toString();
}
