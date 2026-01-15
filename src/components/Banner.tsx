/**
 * 横幅组件
 * 参考 nnnnzs.cn/components/Banner.vue 的设计
 */

"use client";

import React, { useEffect } from "react";
import { DownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface BannerProps {
  cover?: string;
  title?: string;
  subtitle?: string;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
}

export default function Banner({ cover, anchorRef }: BannerProps) {
  const defaultCover = `https://static.nnnnzs.cn/bing/${dayjs().format(
    "YYYYMMDD"
  )}.png`;
  const bannerImage = cover || defaultCover;

  /**
   * 滚动到文章列表
   */
  const scrollIntoPost = React.useCallback(() => {
    if (anchorRef?.current) {
      anchorRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [anchorRef]);

  /**
   * 自动滚动
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.scrollY === 0) {
        scrollIntoPost();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [scrollIntoPost]);

  return (
    <div className="relative snap-start">
      <div
        className="banner relative flex h-screen items-center justify-center bg-cover bg-scroll bg-center md:bg-fixed"
        style={{
          backgroundImage: `url(${bannerImage})`,
        }}
      >
        {/* 一言文字 */}
        <div className="mix-blend-difference p-8 text-2xl text-white antialiased transition-all duration-300 hover:backdrop-blur-[3px]">
          <p className="mb-20">记录技术，分享生活</p>
        </div>

        {/* 滚动提示 */}
        <div
          onClick={scrollIntoPost}
          className="absolute bottom-4 left-0 right-0 cursor-pointer text-center text-white animate-bounce"
        >
          <DownOutlined className="text-4xl" />
        </div>
      </div>
    </div>
  );
}
