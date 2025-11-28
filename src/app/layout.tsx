import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";
import Header from "@/components/Header";

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
        </body>
      </AuthProvider>
    </html>
  );
}
