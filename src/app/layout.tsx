import type { Metadata } from "next";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from '@/contexts/AuthContext';
import "./globals.css";

export const metadata: Metadata = {
  title: "我的博客",
  description: "记录技术，分享生活",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AntdRegistry>
          <ConfigProvider locale={zhCN}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
