/**
 * 页脚组件
 * 基于设计稿重构
 */

"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import BackToTop from "@/components/BackToTop";

interface BuildInfo {
  version: string;
  buildDate: string;
  commitSha: string;
}

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    // 读取构建信息
    fetch("/version.json")
      .then((res) => res.json())
      .then((data) => setBuildInfo(data))
      .catch(() => {
        // 本地开发环境可能没有 version.json，使用默认值
        setBuildInfo({
          version: "dev",
          buildDate: new Date().toISOString(),
          commitSha: "local",
        });
      });
  }, []);

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-700 bg-gray-100 dark:bg-[#161f32]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 md:gap-12 md:grid-cols-3">
          {/* 关于 */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              关于博主
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Neon Nomad Navigating Night Zones。这里记录前端架构、后端服务、人工智能等领域的实践与思考。
            </p>
          </div>

          {/* 快速链接 */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              快速链接
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link
                  href="/archives"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  归档
                </Link>
              </li>
              <li>
                <Link
                  href="/tags"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  分类
                </Link>
              </li>
              <li>
                <Link
                  href="/tags"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  标签
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/NNNNzs/react.nnnnzs.cn/actions/workflows/docker-release.yml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block"
                >
                  <img
                    src="https://img.shields.io/github/actions/workflow/status/NNNNzs/react.nnnnzs.cn/docker-release.yml?branch=main&style=flat-square&label=Docker+Release"
                    alt="Docker Release"
                    className="h-5"
                  />
                </a>
              </li>
            </ul>
          </div>

          {/* 联系方式 */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              联系我
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                Email:{" "}
                <a
                  href="mailto:nnnnzs@vip.qq.com"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  nnnnzs@vip.qq.com
                </a>
              </li>
              <li>
                GitHub:{" "}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  href="https://github.com/NNNNzs"
                >
                  @NNNNzs
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-12 pt-8 border-t border-slate-300 dark:border-slate-700 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            © {currentYear} 我的博客. All rights reserved.
            <br className="md:hidden" />
            <span className="hidden md:inline"> | </span>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              皖ICP备16025009号-1
            </a>
            {buildInfo && buildInfo.buildDate && (
              <>
                <br className="md:hidden" />
                <span className="hidden md:inline"> | </span>
                <span className="font-mono">
                  构建于 {new Date(buildInfo.buildDate).toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* 返回顶部按钮 */}
      <BackToTop />
    </footer>
  );
}
