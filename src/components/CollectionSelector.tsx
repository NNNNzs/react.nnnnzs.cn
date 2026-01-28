/**
 * 合集选择器组件
 * 用于文章编辑页选择合集
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Select, message } from "antd";
import type { GetProps } from "antd";
import type { SerializedCollection } from "@/dto/collection.dto";

interface CollectionSelectorProps {
  value?: number[];
  onChange?: (value: number[]) => void;
  disabled?: boolean;
  mode?: "multiple" | "tags";
  placeholder?: string;
}

type SelectProps = GetProps<typeof Select>;

function CollectionSelector({
  value = [],
  onChange,
  disabled = false,
  mode = "multiple",
  placeholder = "选择合集",
}: CollectionSelectorProps) {
  const [collections, setCollections] = useState<SerializedCollection[]>([]);
  const [loading, setLoading] = useState(false);

  // 使用 useCallback 避免依赖警告
  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      // 获取所有合集（包括隐藏的）
      const res = await fetch("/api/collections?status=1&pageSize=100&pageNum=1");
      const data = await res.json();

      if (data.status) {
        setCollections(data.data.record);
      } else {
        message.error("获取合集列表失败");
      }
    } catch (error) {
      console.error("获取合集列表失败:", error);
      message.error("获取合集列表失败");
    } finally {
      setLoading(false);
    }
  }, []); // 空依赖数组，只在挂载时执行一次

  const options: SelectProps["options"] = collections.map((c) => ({
    label: c.title,
    value: c.id,
  }));

  // 添加 useEffect 调用 loadCollections
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  return (
    <Select
      mode={mode}
      placeholder={placeholder}
      loading={loading}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      allowClear
      className="w-full"
    />
  );
}

// 使用 React.memo 优化重渲染
export default React.memo(CollectionSelector);
