import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  reactCompiler: true,
  // instrumentation hook 在 Next.js 16 中默认启用，无需配置
  turbopack: {
    root: __dirname,
  },
  // 安全的images字段host配置
  images: {
    // 同时配置 remotePatterns
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'static.nnnnzs.cn',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.nnnnzs.cn',
        port: '',
        pathname: '/**',
      },
    ],
    // 图片格式
    formats: ['image/webp'],
    // 图片尺寸
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 最小缓存时间
    minimumCacheTTL: 60,
  },
};

export default nextConfig;
