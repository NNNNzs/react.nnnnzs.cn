/**
 * 页脚组件
 * 基于设计稿重构
 */

"use client";

import React from "react";
import Link from "next/link";
import BackToTop from "@/components/BackToTop";

export default function Footer() {
  const currentYear = new Date().getFullYear();

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
              记录技术，分享生活。这里是一个全栈开发者的数字花园，涵盖前端架构、后端服务、人工智能等领域的实践与思考。
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
                <Link
                  href="https://github.com/NNNNzs/react.nnnnzs.cn/actions/workflows/docker-release.yml"
                  className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    Docker Release
                  </span>
                  <span className="bg-[#4ade80] text-black text-[10px] px-1.5 py-0.5 rounded font-mono -ml-2">
                    passing
                  </span>
                </Link>
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
          </p>
        </div>
      </div>

      {/* 返回顶部按钮 */}
      <BackToTop />
    </footer>
  );
}
