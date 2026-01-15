/**
 * 合集选择器组件
 * 用于文章编辑页选择合集
 */

"use client";

import React, { useEffect, useState } from "react";
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

export default function CollectionSelector({
  value = [],
  onChange,
  disabled = false,
  mode = "multiple",
  placeholder = "选择合集",
}: CollectionSelectorProps) {
  const [collections, setCollections] = useState<SerializedCollection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
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
  };

  const options: SelectProps["options"] = collections.map((c) => ({
    label: c.title,
    value: c.id,
  }));

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
