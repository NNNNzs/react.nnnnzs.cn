const ADSENSE_EXCLUDED_ROUTES = [
  '/c',
  '/create',
  '/preview',
  '/login',
  '/authorize',
  '/bind-wechat',
  '/notifications',
  '/chat',
  '/archives',
  '/privacy',
  '/notification-policy',
] as const;

export function isAdSenseExcludedRoute(pathname: string): boolean {
  return ADSENSE_EXCLUDED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
