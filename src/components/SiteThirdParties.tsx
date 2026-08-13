'use client';

import { GoogleTagManager } from '@next/third-parties/google';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import GoogleAdSense from '@/components/GoogleAdSense';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';

export function SiteThirdParties({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  if (pathname === '/preview') return null;
  return (
    <>
      <Script id="baidu-analytics" strategy="afterInteractive">
        {`var _hmt = _hmt || [];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?51f12d30a4c94bac90b35bde7079f7b8";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s)})();`}
      </Script>
      <GoogleAdSense />
      <GoogleTagManager gtmId="GTM-PTJQT23X" />
      <GoogleAnalytics measurementId={measurementId} />
    </>
  );
}
