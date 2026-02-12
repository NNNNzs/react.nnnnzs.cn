import type { Metadata } from "next";
import Script from "next/script";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider } from "@/contexts/AuthContext";
import { HeaderStyleProvider } from "@/contexts/HeaderStyleContext";
import { CurrentPostProvider } from "@/contexts/CurrentPostContext";
import { GoogleTagManager } from "@next/third-parties/google";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { getAnalyticsConfig } from "@/lib/analytics-config";
import "./globals.css";
// import "./antd-fix.css";
import Header from "@/components/Header";
// 初始化向量化队列
import "@/lib/embedding-init";

export const metadata: Metadata = {
  title: "NNNNzs",
  description: "记录技术，分享生活",
};
export const experimental = {
  scrollRestoration: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 获取 GA4 配置
  const analyticsConfig = await getAnalyticsConfig();

  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
    >
      <AuthProvider>
        <CurrentPostProvider>
          <HeaderStyleProvider>
            <AntdRegistry>
              <ConfigProvider
                locale={zhCN}
                theme={{
                  token: {
                    colorPrimary: "#1677ff",
                    borderRadius: 6,
                    fontSize: 14,
                    lineHeight: 1.5715,
                    controlHeight: 32,
                    controlHeightLG: 40,
                    controlHeightSM: 24,
                  },
                  components: {
                    Button: {
                      controlHeightLG: 40,
                      controlHeight: 32,
                      controlHeightSM: 24,
                    },
                    Input: {
                      controlHeightLG: 40,
                      controlHeight: 32,
                      controlHeightSM: 24,
                    },
                  },
                }}
              >
                <body className="antialiased">
                  <Header />
                  {children}
                  <Script id="baidu-analytics" strategy="afterInteractive">
                    {`
                  var _hmt = _hmt || [];
                  (function() {
                    var hm = document.createElement("script");
                    hm.src = "https://hm.baidu.com/hm.js?51f12d30a4c94bac90b35bde7079f7b8";
                    var s = document.getElementsByTagName("script")[0];
                    s.parentNode.insertBefore(hm, s);
                  })();
                  `}
                  </Script>
                  <GoogleTagManager gtmId="GTM-PTJQT23X" />
                  <GoogleAnalytics measurementId={analyticsConfig.measurementId} />
                </body>
              </ConfigProvider>
            </AntdRegistry>
          </HeaderStyleProvider>
        </CurrentPostProvider>
      </AuthProvider>
    </html>
  );
}
