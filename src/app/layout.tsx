import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Noto_Sans_SC } from "next/font/google";
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

// 配置 Google Fonts
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

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
      className={`${inter.variable} ${notoSansSC.variable}`}
    >
      <head>
        {/* Material Symbols Outlined - 图标字体，通过 CDN 加载以获得更好的缓存效果 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
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
