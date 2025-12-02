import type { Metadata } from "next";
import Script from "next/script";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "NNNNzs",
  description: "记录技术，分享生活",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <AuthProvider>
        <body className="antialiased">
          <Header />
          <AntdRegistry>
            <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
          </AntdRegistry>
          <Footer />
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
      </AuthProvider>
    </html>
  );
}
