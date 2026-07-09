/**
 * 图片生成历史记录列表组件
 * 从后端 API 拉取持久化的历史数据
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Tag,
  Empty,
  Spin,
  Tooltip,
  message,
  Button,
  Space,
  Modal,
  Checkbox,
  Popover,
} from "antd";
import {
  CopyOutlined,
  RobotOutlined,
  DesktopOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  FilterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { USER_MANAGE } from "@/constants/permissions";
import type { ImageGenStatus } from "@/services/image-gen-log";
import ImageGenJobImage, {
  type ImageGenJobSnapshot,
} from "@/components/ImageGen/ImageGenJobImage";
import { ImageOptimizationType } from "@/lib/image";

interface LogRecord {
  id: number;
  user_id: number;
  source: string;
  prompt: string;
  ext_text: string | null;
  ext_json: string | null;
  job_id: string | null;
  size: string | null;
  quality: string | null;
  model: string | null;
  original_url: string | null;
  cdn_url: string | null;
  reserved_cdn_url: string | null;
  cos_key: string | null;
  status: ImageGenStatus;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

/** 从 ext_json 中解析编辑模式的参考图片 URL */
function parseEditImageUrls(extJson: string | null): string[] {
  if (!extJson) return [];
  try {
    const parsed = JSON.parse(extJson);
    if (Array.isArray(parsed.edit_image_urls)) {
      return parsed.edit_image_urls.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0);
    }
    if (typeof parsed.edit_image_url === 'string' && parsed.edit_image_url.trim()) {
      return [parsed.edit_image_url.trim()];
    }
  } catch { /* ignore */ }
  return [];
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

const STATUS_MAP: Record<ImageGenStatus, { label: string; color: string }> = {
  PENDING: { label: "排队中", color: "default" },
  PROCESSING: { label: "处理中", color: "processing" },
  SUCCESS: { label: "成功", color: "success" },
  FAILED: { label: "失败", color: "error" },
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
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  const pageSize = 20;
  const canDelete = hasPermission(USER_MANAGE);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageNum: String(pageNum),
        pageSize: String(pageSize),
      });
      if (sourceFilter) params.set("source", sourceFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/image-gen/logs?${params}`, {
        cache: "no-store",
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
  }, [pageNum, sourceFilter, statusFilter]);

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

  const handleDelete = useCallback(
    (e: React.MouseEvent, record: LogRecord) => {
      e.stopPropagation();
      let deleteCos = true;

      Modal.confirm({
        title: "删除生成记录",
        content: (
          <div className="space-y-3">
            <p>确定删除这条图片生成记录吗？</p>
            <Checkbox defaultChecked onChange={(event) => {
              deleteCos = event.target.checked;
            }}>
              同时删除 COS 中的图片文件
            </Checkbox>
          </div>
        ),
        okText: "删除",
        okType: "danger",
        cancelText: "取消",
        async onOk() {
          const res = await fetch(`/api/image-gen/logs/${record.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deleteCos }),
          });
          const json = await res.json();
          if (!json?.status) {
            throw new Error(json?.message || "删除失败");
          }
          setRecords((items) => items.filter((item) => item.id !== record.id));
          setTotal((count) => Math.max(0, count - 1));
          if (deleteCos && json?.data?.failedCosUrls?.length > 0) {
            message.warning("记录已删除，部分 COS 文件删除失败，请查看服务端日志");
          } else {
            message.success("删除成功");
          }
        },
      });
    },
    []
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === records.length) return new Set();
      return new Set(records.map((r) => r.id));
    });
  }, [records]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    let deleteCos = true;

    Modal.confirm({
      title: `批量删除 ${selectedIds.size} 条记录`,
      content: (
        <div className="space-y-3">
          <p>确定删除选中的 {selectedIds.size} 条图片生成记录吗？</p>
          <Checkbox defaultChecked onChange={(event) => {
            deleteCos = event.target.checked;
          }}>
            同时删除 COS 中的图片文件
          </Checkbox>
        </div>
      ),
      okText: "批量删除",
      okType: "danger",
      cancelText: "取消",
      async onOk() {
        setBatchDeleting(true);
        try {
          const res = await fetch("/api/image-gen/logs", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ids: Array.from(selectedIds),
              deleteCos,
            }),
          });
          const json = await res.json();
          if (!json?.status) {
            throw new Error(json?.message || "批量删除失败");
          }
          const deletedCount = json.data?.deletedCount || 0;
          setRecords((items) => items.filter((item) => !selectedIds.has(item.id)));
          setTotal((count) => Math.max(0, count - deletedCount));
          setSelectedIds(new Set());
          setSelectMode(false);
          if (deleteCos && json?.data?.failedCosUrls?.length > 0) {
            message.warning(`已删除 ${deletedCount} 条记录，部分 COS 文件删除失败`);
          } else {
            message.success(`成功删除 ${deletedCount} 条记录`);
          }
        } finally {
          setBatchDeleting(false);
        }
      },
    });
  }, [selectedIds]);

  const displayUrl = (record: LogRecord) =>
    record.status === "SUCCESS" ? record.cdn_url || record.original_url : null;

  const updateRecordFromJob = useCallback((recordId: number, job: ImageGenJobSnapshot) => {
    setRecords((items) => items.map((item) => {
      if (item.id !== recordId) return item;
      return {
        ...item,
        status: (job.status || item.status) as ImageGenStatus,
        cdn_url: job.status === "SUCCESS" ? job.imageUrl || job.cdnUrl || item.cdn_url : item.cdn_url,
        reserved_cdn_url: job.reservedCdnUrl || item.reserved_cdn_url,
        error_message: job.errorMessage ?? item.error_message,
        size: job.size || item.size,
        quality: job.quality || item.quality,
        model: job.model || item.model,
      };
    }));
  }, []);

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
        <Space size={4}>
          {canDelete && !selectMode && (
            <Tooltip title="多选删除">
              <Button variant="text"
                size="small"
                icon={<CheckSquareOutlined />}
                onClick={() => setSelectMode(true)}
              />
            </Tooltip>
          )}
          {selectMode && (
            <>
              <Button variant="text"
                size="small"
                onClick={exitSelectMode}
              >
                取消
              </Button>
              {selectedIds.size > 0 && (
                <>
                  <Button variant="text"
                    size="small"
                    icon={<BorderOutlined />}
                    onClick={toggleSelectAll}
                  >
                    {selectedIds.size === records.length ? "取消全选" : "全选"}
                  </Button>
                  <Button variant="solid" color="danger"
                    size="small"
                    loading={batchDeleting}
                    onClick={handleBatchDelete}
                  >
                    删除 ({selectedIds.size})
                  </Button>
                </>
              )}
            </>
          )}
          <Popover
            trigger="click"
            placement="bottomRight"
            title="筛选条件"
            content={
              <div className="space-y-3 min-w-[160px]">
                <div>
                  <p className="text-xs text-gray-500 mb-1">来源</p>
                  <Checkbox.Group
                    value={sourceFilter ? [sourceFilter] : []}
                    onChange={(vals) => {
                      const v = vals.length === 1 ? vals[0] : undefined;
                      setSourceFilter(v);
                      setPageNum(1);
                    }}
                    options={[
                      { label: "后台", value: "ADMIN" },
                      { label: "MCP", value: "MCP" },
                    ]}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">状态</p>
                  <Checkbox.Group
                    value={statusFilter ? [statusFilter] : []}
                    onChange={(vals) => {
                      const v = vals.length === 1 ? vals[0] : undefined;
                      setStatusFilter(v);
                      setPageNum(1);
                    }}
                    options={[
                      { label: "排队中", value: "PENDING" },
                      { label: "处理中", value: "PROCESSING" },
                      { label: "成功", value: "SUCCESS" },
                      { label: "失败", value: "FAILED" },
                    ]}
                  />
                </div>
                {(sourceFilter || statusFilter) && (
                  <Button variant="link"
                    size="small"
                    onClick={() => {
                      setSourceFilter(undefined);
                      setStatusFilter(undefined);
                      setPageNum(1);
                    }}
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            }
          >
            <Tooltip title="筛选">
              <Button variant="text"
                size="small"
                icon={<FilterOutlined />}
                className={sourceFilter || statusFilter ? "text-blue-500" : ""}
              />
            </Tooltip>
          </Popover>
          <Tooltip title="刷新">
            <Button variant="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={fetchLogs}
              loading={loading}
            />
          </Tooltip>
        </Space>
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
              const statusInfo = STATUS_MAP[record.status] || { label: record.status, color: 'default' };
              const isSelected = selectedIds.has(record.id);

              return (
                <div
                  key={record.id}
                  className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-400"
                  }`}
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(record.id);
                    } else if (url) {
                      onSelect?.(url, record.prompt);
                    }
                  }}
                >
                  {/* 选中勾 */}
                  {selectMode && (
                    <div className="absolute top-1 left-1 z-10">
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                        isSelected
                          ? "bg-blue-500 text-white"
                          : "bg-white/80 dark:bg-gray-800/80 text-transparent border border-gray-300 dark:border-gray-600"
                      }`}>
                        {isSelected && "✓"}
                      </div>
                    </div>
                  )}

                  {/* 缩略图 */}
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                    <ImageGenJobImage
                      job={{
                        jobId: record.job_id,
                        status: record.status,
                        imageUrl: url,
                        reservedCdnUrl: record.reserved_cdn_url,
                        errorMessage: record.error_message,
                        model: record.model,
                        size: record.size,
                        quality: record.quality,
                      }}
                      imageUrl={url}
                      alt={record.prompt.slice(0, 20)}
                      preview={false}
                      optimizationType={ImageOptimizationType.SMALL_THUMBNAIL}
                      className="h-full w-full"
                      onJobChange={(job) => updateRecordFromJob(record.id, job)}
                    />
                  </div>

                  {/* 底部信息 */}
                  <div className="p-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1">
                      {record.prompt.slice(0, 40)}
                      {record.prompt.length > 40 ? "..." : ""}
                    </p>
                    {/* 编辑模式：展示参考图片缩略图 */}
                    {(() => {
                      const refUrls = parseEditImageUrls(record.ext_json);
                      if (refUrls.length === 0) return null;
                      return (
                        <div className="flex gap-1 mb-1 overflow-hidden">
                          {refUrls.map((refUrl, idx) => (
                            <Tooltip key={idx} title={`参考图 ${idx + 1}`}>
                              <div className="h-6 w-6 overflow-hidden rounded-sm border border-gray-200 dark:border-gray-600">
                                <ImageGenJobImage
                                  imageUrl={refUrl}
                                  alt={`参考图 ${idx + 1}`}
                                  preview={false}
                                  optimizationType={ImageOptimizationType.SMALL_THUMBNAIL}
                                  className="h-full w-full"
                                />
                              </div>
                            </Tooltip>
                          ))}
                          <span className="text-[10px] text-gray-400 self-center">
                            参考图
                          </span>
                        </div>
                      );
                    })()}
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
                        <Tag
                          color={statusInfo.color}
                          className="text-xs m-0 scale-90 origin-left"
                        >
                          {statusInfo.label}
                        </Tag>
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <ClockCircleOutlined className="text-[10px]" />
                          {formatDuration(record.duration_ms)}
                        </span>
                      </Space>
                      {!selectMode && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {url && (
                            <Tooltip title="复制图片链接">
                              <Button variant="text"
                                size="small"
                                icon={<CopyOutlined />}
                                className="text-xs"
                                onClick={(e) => handleCopyUrl(e, url)}
                              />
                            </Tooltip>
                          )}
                          <Tooltip title="复制提示词">
                            <Button variant="text"
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
                          {canDelete && (
                            <Tooltip title="删除记录">
                              <Button variant="text" color="danger"
                                size="small"
                                icon={<DeleteOutlined />}
                                className="text-xs"
                                onClick={(e) => handleDelete(e, record)}
                              />
                            </Tooltip>
                          )}
                        </div>
                      )}
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
          <Button variant="text"
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
