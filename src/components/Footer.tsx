/**
 * 页脚组件
 */

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* 关于 */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              关于博客
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              记录技术，分享生活。
            </p>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              快速链接
            </h3>
            <ul className="space-y-2 text-sm">
              {/* 归档 */}
              <li>
                <Link
                  href="/archives"
                  className="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                >
                  归档
                </Link>
              </li>
              {/* 分类 */}
              <li>
                <Link
                  href="/tags"
                  className="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                >
                  分类
                </Link>
              </li>
              <li>
                <Link
                  href="/tags"
                  className="text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                >
                  标签
                </Link>
              </li>
              <li>
                <Link href="https://github.com/NNNNzs/react.nnnnzs.cn/actions/workflows/docker-release.yml">
                  <Image
                    src="https://github.com/NNNNzs/react.nnnnzs.cn/actions/workflows/docker-release.yml/badge.svg"
                    alt="Docker Release"
                    width={180}
                    height={200}
                    unoptimized={true}
                  ></Image>
                </Link>
              </li>
            </ul>
          </div>

          {/* 联系方式 */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              联系我
            </h3>
            <ul className="space-y-2 text-sm">
              <li></li>

              <li className="text-slate-600 dark:text-slate-400">
                Email: nnnnzs@vip.qq.com
              </li>
              <li className="text-slate-600 dark:text-slate-400">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-full align-middle flex items-center hover:opacity-70 transition-opacity"
                  href="https://github.com/NNNNzs"
                >
                  GitHub: @NNNNzs
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-8 border-t pt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>© {currentYear} 我的博客. All rights reserved.</p>
          <p>皖ICP备16025009号-1</p>
        </div>
      </div>
    </footer>
  );
}
