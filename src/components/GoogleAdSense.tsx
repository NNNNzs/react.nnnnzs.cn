"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const ADSENSE_SCRIPT_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6540786548340758";

function isBackofficeRoute(pathname: string) {
  return (
    pathname === "/c" ||
    pathname.startsWith("/c/") ||
    pathname === "/create" ||
    pathname.startsWith("/create/")
  );
}

/**
 * 后台不需要广告；公开页面在 hydration 完成后再加载 AdSense。
 */
export default function GoogleAdSense() {
  const pathname = usePathname();

  if (isBackofficeRoute(pathname)) {
    return null;
  }

  return (
    <Script
      id="google-adsense"
      src={ADSENSE_SCRIPT_SRC}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
