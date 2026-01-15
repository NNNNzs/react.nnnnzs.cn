/**
 * 合集卡片组件
 * 用于合集列表页展示
 */

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOutlined, EyeOutlined } from "@ant-design/icons";
import type { SerializedCollection } from "@/dto/collection.dto";

interface CollectionCardProps {
  collection: SerializedCollection;
  className?: string;
}

export default function CollectionCard({ collection, className = "" }: CollectionCardProps) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className={`block group ${className}`}
    >
      <div className="relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all">
        {/* 背景图片 */}
        {collection.cover ? (
          <div className="relative h-48 w-full">
            <Image
              src={collection.cover}
              alt={collection.title}
              fill
              unoptimized={true}
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="h-48 w-full bg-gradient-to-br from-blue-500 to-purple-600" />
        )}

        {/* 遮罩层 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* 内容 */}
        <div className="absolute bottom-0 p-4 text-white w-full">
          <h3 className="text-lg font-bold mb-1 line-clamp-1">
            {collection.title}
          </h3>
          {collection.description && (
            <p className="text-sm opacity-90 line-clamp-2 mb-2">
              {collection.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs opacity-80">
            <span className="flex items-center">
              <BookOutlined className="mr-1" />
              {collection.article_count} 篇
            </span>
            <span className="flex items-center">
              <EyeOutlined className="mr-1" />
              {collection.total_views}
            </span>
          </div>
        </div>

        {/* Hover 效果 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>
    </Link>
  );
}
