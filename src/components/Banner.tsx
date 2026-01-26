/**
 * 横幅组件
 * 参考 nnnnzs.cn/components/Banner.vue 的设计
 * 所有页面都使用大图背景
 * 支持视频背景（自动播放、静音、无控制条）
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { DownOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface BannerProps {
  cover?: string;
  title?: string;
  subtitle?: string;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 检测 URL 是否为视频
 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi)$/i.test(url);
}

export default function Banner({ cover, title, subtitle, anchorRef }: BannerProps) {
  const defaultCover = `https://static.nnnnzs.cn/bing/${dayjs().format(
    "YYYYMMDD"
  )}.png`;
  const bannerImage = cover || defaultCover;
  const isVideo = cover ? isVideoUrl(cover) : false;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showReplay, setShowReplay] = useState(false);

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

  /**
   * 重放视频
   */
  const handleReplay = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  return (
    <div className="relative snap-start">
      <div className="banner relative flex h-screen items-center justify-center bg-cover bg-scroll bg-center md:bg-fixed">
        {/* 背景层：图片或视频 */}
        {isVideo ? (
          <video
            ref={videoRef}
            src={cover}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backgroundImage: `url(${bannerImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        {/* 视频重放按钮区域 - 只有鼠标移到右上角才显示 */}
        {isVideo && (
          <div
            className="absolute right-0 z-20"
            style={{
              top: "var(--header-height)",
              width: "80px",
              height: "80px",
            }}
            onMouseEnter={() => setShowReplay(true)}
            onMouseLeave={() => setShowReplay(false)}
          >
            <button
              onClick={handleReplay}
              className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
              style={{
                opacity: showReplay ? 1 : 0,
              }}
              title="重放视频"
            >
              <ReloadOutlined className="text-xl" />
            </button>
          </div>
        )}

        {/* 标题区域 - 如果提供了 title */}
        {title && (
          <div className="mix-blend-difference p-8 text-center antialiased relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {title}
            </h1>
            {subtitle && (
              <p className="text-lg text-white/90">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* 如果没有 title，显示默认的一言 */}
        {!title && (
          <div className="mix-blend-difference p-8 text-2xl text-white antialiased transition-all duration-300 hover:backdrop-blur-[3px] relative z-10">
            <p className="mb-20">记录技术，分享生活</p>
          </div>
        )}

        {/* 滚动提示 */}
        <div
          onClick={scrollIntoPost}
          className="absolute bottom-4 left-0 right-0 cursor-pointer text-center text-white animate-bounce z-10"
        >
          <DownOutlined className="text-4xl" />
        </div>
      </div>
    </div>
  );
}
