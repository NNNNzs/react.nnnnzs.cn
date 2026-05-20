/**
 * 图片生成历史记录列表组件
 * 从后端 API 拉取持久化的历史数据
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Image,
  Tag,
  Empty,
  Spin,
  Tooltip,
  message,
  Button,
  Select,
  Space,
} from "antd";
import {
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  DesktopOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";

interface LogRecord {
  id: number;
  user_id: number;
  source: string;
  prompt: string;
  edit_prompt: string | null;
  edit_image_url: string | null;
  model: string;
  original_url: string;
  cdn_url: string | null;
  status: string;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

interface ImageGenHistoryProps {
  /** 点击历史项时的回调，传回图片 URL */
  onSelect?: (imageUrl: string, prompt: string) => void;
  /** 触发刷新的外部信号（如生成新图片后递增） */
  refreshTrigger?: number;
}

const SOURCE_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  MCP: { label: "MCP", color: "purple", icon: <RobotOutlined /> },
  ADMIN: { label: "后台", color: "blue", icon: <DesktopOutlined /> },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

  if (isToday) return `今天 ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${time}`;

  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")} ${time}`;
}

export default function ImageGenHistory({
  onSelect,
  refreshTrigger,
}: ImageGenHistoryProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);

  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageNum: String(pageNum),
        pageSize: String(pageSize),
      });
      if (sourceFilter) params.set("source", sourceFilter);

      const res = await fetch(`/api/image-gen/logs?${params}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json?.status && json?.data) {
        setRecords(json.data.record || []);
        setTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error("Fetch image gen logs failed:", err);
    } finally {
      setLoading(false);
    }
  }, [pageNum, sourceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshTrigger]);

  const handleCopyUrl = useCallback(
    (e: React.MouseEvent, url: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(url).then(
        () => message.success("已复制图片链接"),
        () => message.error("复制失败")
      );
    },
    []
  );

  const handleCopyPrompt = useCallback(
    (e: React.MouseEvent, prompt: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(prompt).then(
        () => message.success("已复制提示词"),
        () => message.error("复制失败")
      );
    },
    []
  );

  const displayUrl = (record: LogRecord) =>
    record.status === "SUCCESS" ? record.cdn_url || record.original_url : null;

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="shrink-0 flex items-center justify-between mb-3">
        <span className="text-sm font-medium">
          历史记录
          {total > 0 && (
            <span className="text-xs text-gray-400 ml-2">{total} 条</span>
          )}
        </span>
        <Select
          value={sourceFilter}
          onChange={(val) => {
            setSourceFilter(val || undefined);
            setPageNum(1);
          }}
          allowClear
          placeholder="来源筛选"
          size="small"
          className="w-28"
          options={[
            { value: "ADMIN", label: "后台" },
            { value: "MCP", label: "MCP" },
          ]}
        />
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && records.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Spin />
          </div>
        ) : records.length === 0 ? (
          <Empty
            image={<EyeOutlined className="text-3xl text-gray-300" />}
            description="暂无生成记录"
            className="py-8"
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {records.map((record) => {
              const url = displayUrl(record);
              const sourceInfo = SOURCE_MAP[record.source];

              return (
                <div
                  key={record.id}
                  className="group relative rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:border-blue-400 transition-all hover:shadow-md"
                  onClick={() => url && onSelect?.(url, record.prompt)}
                >
                  {/* 缩略图 */}
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                    {url ? (
                      <img
                        src={url}
                        alt={record.prompt.slice(0, 20)}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <CloseCircleOutlined className="text-2xl text-red-300" />
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {record.error_message?.slice(0, 50) || "生成失败"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 底部信息 */}
                  <div className="p-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1">
                      {record.prompt.slice(0, 40)}
                      {record.prompt.length > 40 ? "..." : ""}
                    </p>
                    <div className="flex items-center justify-between">
                      <Space size={4} wrap>
                        {sourceInfo && (
                          <Tag
                            color={sourceInfo.color}
                            className="text-xs m-0 scale-90 origin-left"
                          >
                            {sourceInfo.label}
                          </Tag>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <ClockCircleOutlined className="text-[10px]" />
                          {formatDuration(record.duration_ms)}
                        </span>
                      </Space>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {url && (
                          <Tooltip title="复制图片链接">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined />}
                              className="text-xs"
                              onClick={(e) => handleCopyUrl(e, url)}
                            />
                          </Tooltip>
                        )}
                        <Tooltip title="复制提示词">
                          <Button
                            type="text"
                            size="small"
                            icon={
                              <span className="text-[10px]">T</span>
                            }
                            className="text-xs"
                            onClick={(e) =>
                              handleCopyPrompt(e, record.prompt)
                            }
                          />
                        </Tooltip>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-300 mt-0.5">
                      {formatTime(record.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="shrink-0 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-center">
          <Button
            type="text"
            size="small"
            disabled={pageNum * pageSize >= total}
            onClick={() => setPageNum((p) => p + 1)}
          >
            加载更多
          </Button>
        </div>
      )}
    </div>
  );
}
