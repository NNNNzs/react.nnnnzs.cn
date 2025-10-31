import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  // 安全的images字段host
  images: {
    domains: ['static.nnnnzs.cn'],
  },
};

export default nextConfig;
