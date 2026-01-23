import type { Metadata } from "next";
import Script from "next/script";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider } from "@/contexts/AuthContext";
import { HeaderStyleProvider } from "@/contexts/HeaderStyleContext";
import { CurrentPostProvider } from "@/contexts/CurrentPostContext";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Google Fonts: Inter + Noto Sans SC */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* Material Symbols Outlined */}
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
                </body>
              </ConfigProvider>
            </AntdRegistry>
          </HeaderStyleProvider>
        </CurrentPostProvider>
      </AuthProvider>
    </html>
  );
}
