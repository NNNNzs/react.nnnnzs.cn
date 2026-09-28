/**
 * 页脚组件
 * 基于设计稿重构
 */

"use client";

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

  // 校验 buildDate 是否为合法日期，避免渲染出 "Invalid Date"
  const formattedBuildDate = (() => {
    if (!buildInfo?.buildDate) return null;
    const d = new Date(buildInfo.buildDate);
    return Number.isNaN(d.getTime()) ? null : d;
  })();

  useEffect(() => {
    // 读取构建信息（加时间戳参数避免 CDN 缓存）
    fetch(`/version.json?t=${Date.now()}`)
      .then((res) => res.json())
      .then((data: BuildInfo) => setBuildInfo(data))
      .catch(() => {
        // 未提供版本文件时不显示未经证实的构建时间。
        setBuildInfo(null);
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
              NNNNzs 是一名全栈开发者，长期实践 React、Next.js、Node.js、Java、数据库、云原生与 AI 工程。本站聚焦真实项目中的架构取舍、故障排查、工具开发和原创技术记录。
            </p>
          </div>

          {/* 快速链接 */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              快速链接
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/collections" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  合集
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  回想 · AI 工具
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  关于博主
                </Link>
              </li>
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
                  href="/categories"
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
                <Link href="/contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  联系方式
                </Link>
              </li>
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
          <p className="text-xs text-slate-600 dark:text-slate-400">© {currentYear} NNNNzs. All rights reserved.</p>
          <nav aria-label="站点说明" className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
            <Link
              href="/privacy"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              隐私政策
            </Link>
            <Link
              href="/notification-policy"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              通知策略
            </Link>
            <Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              免责声明与服务条款
            </Link>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              皖ICP备16025009号-1
            </a>
          </nav>
          {formattedBuildDate && (
            <p className="mt-3 font-mono text-xs text-slate-600 dark:text-slate-400">
              构建于 {formattedBuildDate.toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      {/* 返回顶部按钮 */}
      <BackToTop />
    </footer>
  );
}
