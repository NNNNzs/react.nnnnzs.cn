"use client";

/**
 * 管理后台 - CDN 刷新记录
 * 路由: /c/cdn-logs
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  DatePicker,
  Input,
  message,
  Select,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { Dayjs } from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import { CDN_PURGE_VIEW } from "@/constants/permissions";
import ResponsiveTable from "@/components/ResponsiveTable";
import {
  AdminActionButton,
  AdminPageHeader,
  AdminTableActions,
} from "@/components/admin/AdminPageHeader";

const { Text } = Typography;
const { RangePicker } = DatePicker;
const SHANGHAI_TIMEZONE = "Asia/Shanghai";

dayjs.extend(utc);
dayjs.extend(timezone);

type PurgeType = "url" | "path";
type PurgeStatus = "process" | "done" | "fail";
type PurgeArea = "mainland" | "overseas" | "global";

interface PurgeTaskRecord {
  TaskId?: string;
  Url?: string;
  Status?: PurgeStatus;
  PurgeType?: PurgeType;
  FlushType?: "flush" | "delete";
  CreateTime?: string;
}

interface QueryState {
  pageNum: number;
  pageSize: number;
  keyword: string;
  purgeType: PurgeType | "";
  status: PurgeStatus | "";
  area: PurgeArea | "";
  startTime: string;
  endTime: string;
}

function getDefaultDateRange(): [string, string] {
  const end = dayjs().tz(SHANGHAI_TIMEZONE);
  return [
    end.subtract(7, "day").format("YYYY-MM-DD HH:mm:ss"),
    end.format("YYYY-MM-DD HH:mm:ss"),
  ];
}

function parsePositiveParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function useUrlState(): QueryState {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const [defaultStartTime, defaultEndTime] = getDefaultDateRange();
    return {
      pageNum: parsePositiveParam(searchParams.get("page"), 1),
      pageSize: parsePositiveParam(searchParams.get("pageSize"), 20),
      keyword: searchParams.get("q") || "",
      purgeType: (searchParams.get("purgeType") as PurgeType | "") || "",
      status: (searchParams.get("status") as PurgeStatus | "") || "",
      area: (searchParams.get("area") as PurgeArea | "") || "",
      startTime: searchParams.get("startTime") || defaultStartTime,
      endTime: searchParams.get("endTime") || defaultEndTime,
    };
  }, [searchParams]);
}

function useUpdateUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Partial<QueryState>) => {
      const params = new URLSearchParams(searchParams.toString());

      const setOrDelete = (key: string, value: string | number | undefined) => {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      };

      if (updates.pageNum !== undefined) setOrDelete("page", updates.pageNum);
      if (updates.pageSize !== undefined) setOrDelete("pageSize", updates.pageSize);
      if (updates.keyword !== undefined) setOrDelete("q", updates.keyword);
      if (updates.purgeType !== undefined) setOrDelete("purgeType", updates.purgeType);
      if (updates.status !== undefined) setOrDelete("status", updates.status);
      if (updates.area !== undefined) setOrDelete("area", updates.area);
      if (updates.startTime !== undefined) setOrDelete("startTime", updates.startTime);
      if (updates.endTime !== undefined) setOrDelete("endTime", updates.endTime);

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );
}

function formatDateTime(value: string | undefined): string {
  return value ? dayjs.tz(value, SHANGHAI_TIMEZONE).format("YYYY-MM-DD HH:mm:ss") : "-";
}

function getPurgeTypeLabel(value: PurgeType | undefined): string {
  return value === "path" ? "目录刷新" : value === "url" ? "URL 刷新" : "-";
}

function getStatusLabel(value: PurgeStatus | undefined): string {
  return value === "done" ? "成功" : value === "fail" ? "失败" : value === "process" ? "刷新中" : "未知";
}

function getStatusColor(value: PurgeStatus | undefined): string {
  return value === "done" ? "success" : value === "fail" ? "error" : value === "process" ? "processing" : "default";
}

function PageContent() {
  const { user, hasPermission } = useAuth();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();
  const [data, setData] = useState<PurgeTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [keywordInput, setKeywordInput] = useState(urlState.keyword);

  useEffect(() => {
    setKeywordInput(urlState.keyword);
  }, [urlState.keyword]);

  const loadData = useCallback(async () => {
    if (!user || !hasPermission(CDN_PURGE_VIEW)) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageNum: String(urlState.pageNum),
        pageSize: String(urlState.pageSize),
        startTime: urlState.startTime,
        endTime: urlState.endTime,
      });
      if (urlState.keyword) params.set("keyword", urlState.keyword);
      if (urlState.purgeType) params.set("purgeType", urlState.purgeType);
      if (urlState.status) params.set("status", urlState.status);
      if (urlState.area) params.set("area", urlState.area);

      const response = await fetch(`/api/admin/cdn/purge-tasks?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json() as {
        status?: boolean;
        message?: string;
        data?: { record?: PurgeTaskRecord[]; total?: number };
      };

      if (!response.ok || !result.status) {
        throw new Error(result.message || "查询 CDN 刷新记录失败");
      }

      setData(result.data?.record || []);
      setTotal(result.data?.total || 0);
    } catch (error) {
      setData([]);
      setTotal(0);
      message.error(error instanceof Error ? error.message : "查询 CDN 刷新记录失败");
    } finally {
      setLoading(false);
    }
  }, [hasPermission, user, urlState]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateFilters = useCallback(
    (updates: Partial<QueryState>) => {
      updateUrl({ ...updates, pageNum: 1 });
    },
    [updateUrl],
  );

  const resetFilters = useCallback(() => {
    const [startTime, endTime] = getDefaultDateRange();
    setKeywordInput("");
    updateUrl({
      pageNum: 1,
      keyword: "",
      purgeType: "",
      status: "",
      area: "",
      startTime,
      endTime,
    });
  }, [updateUrl]);

  const columns: TableColumnsType<PurgeTaskRecord> = useMemo(
    () => [
      {
        title: "提交时间",
        dataIndex: "CreateTime",
        key: "CreateTime",
        width: 170,
        render: (value: string | undefined) => formatDateTime(value),
      },
      {
        title: "刷新类型",
        dataIndex: "PurgeType",
        key: "PurgeType",
        width: 110,
        render: (value: PurgeType | undefined) => (
          <Tag color={value === "path" ? "purple" : "blue"}>{getPurgeTypeLabel(value)}</Tag>
        ),
      },
      {
        title: "刷新目标",
        dataIndex: "Url",
        key: "Url",
        ellipsis: true,
        render: (value: string | undefined) => (
          value ? (
            <Tooltip title={value}>
              <span className="block max-w-[420px] truncate font-mono text-xs">{value}</span>
            </Tooltip>
          ) : "-"
        ),
      },
      {
        title: "刷新方式",
        dataIndex: "FlushType",
        key: "FlushType",
        width: 120,
        render: (value: "flush" | "delete" | undefined) => value === "delete" ? "全部刷新" : value === "flush" ? "更新资源" : "-",
      },
      {
        title: "状态",
        dataIndex: "Status",
        key: "Status",
        width: 100,
        render: (value: PurgeStatus | undefined) => <Tag color={getStatusColor(value)}>{getStatusLabel(value)}</Tag>,
      },
      {
        title: "任务 ID",
        dataIndex: "TaskId",
        key: "TaskId",
        width: 190,
        render: (value: string | undefined) => value ? <Text copyable={{ text: value }} className="font-mono text-xs">{value}</Text> : "-",
      },
    ],
    [],
  );

  const renderMobileCard = useCallback((record: PurgeTaskRecord) => (
    <Card size="small" className="mb-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Tag color={record.PurgeType === "path" ? "purple" : "blue"}>{getPurgeTypeLabel(record.PurgeType)}</Tag>
        <Tag color={getStatusColor(record.Status)}>{getStatusLabel(record.Status)}</Tag>
      </div>
      <Tooltip title={record.Url || "-"}>
        <div className="mb-2 truncate font-mono text-xs text-gray-600">{record.Url || "-"}</div>
      </Tooltip>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{formatDateTime(record.CreateTime)}</span>
        <span>{record.FlushType === "delete" ? "全部刷新" : record.FlushType === "flush" ? "更新资源" : "-"}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Text ellipsis={{ tooltip: record.TaskId }} className="max-w-[75%] font-mono text-xs text-gray-400">
          {record.TaskId || "无任务 ID"}
        </Text>
        {record.TaskId && <AdminTableActions><AdminActionButton onClick={() => void navigator.clipboard?.writeText(record.TaskId || "")}>复制 ID</AdminActionButton></AdminTableActions>}
      </div>
    </Card>
  ), []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <AdminPageHeader
          title="CDN 刷新记录"
          extra={<Button icon={<ReloadOutlined />} onClick={() => void loadData()} size="small">刷新</Button>}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            placeholder="域名或完整 URL"
            allowClear
            enterButton={<SearchOutlined />}
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onSearch={(value) => updateFilters({ keyword: value })}
            style={{ width: 230 }}
          />
          <RangePicker
            showTime
            value={[
              dayjs.tz(urlState.startTime, SHANGHAI_TIMEZONE),
              dayjs.tz(urlState.endTime, SHANGHAI_TIMEZONE),
            ] as [Dayjs, Dayjs]}
            onChange={(dates) => {
              if (dates?.[0] && dates[1]) {
                updateFilters({
                  startTime: dates[0].format("YYYY-MM-DD HH:mm:ss"),
                  endTime: dates[1].format("YYYY-MM-DD HH:mm:ss"),
                });
              }
            }}
            style={{ width: 360 }}
          />
          <Select
            allowClear
            placeholder="刷新类型"
            value={urlState.purgeType || undefined}
            onChange={(value: PurgeType | undefined) => updateFilters({ purgeType: value || "" })}
            options={[{ label: "URL 刷新", value: "url" }, { label: "目录刷新", value: "path" }]}
            style={{ width: 130 }}
          />
          <Select
            allowClear
            placeholder="状态"
            value={urlState.status || undefined}
            onChange={(value: PurgeStatus | undefined) => updateFilters({ status: value || "" })}
            options={[{ label: "刷新中", value: "process" }, { label: "成功", value: "done" }, { label: "失败", value: "fail" }]}
            style={{ width: 110 }}
          />
          <Select
            allowClear
            placeholder="刷新地域"
            value={urlState.area || undefined}
            onChange={(value: PurgeArea | undefined) => updateFilters({ area: value || "" })}
            options={[{ label: "境内", value: "mainland" }, { label: "境外", value: "overseas" }, { label: "全球", value: "global" }]}
            style={{ width: 120 }}
          />
          <Button onClick={resetFilters}>重置</Button>
        </div>

        <ResponsiveTable<PurgeTaskRecord>
          columns={columns}
          dataSource={data}
          rowKey={(record, index) => [
            record.TaskId || "task",
            record.Url || "url",
            record.CreateTime || "time",
            record.PurgeType || "type",
            index,
          ].join(":")}
          loading={loading}
          renderMobileCard={renderMobileCard}
          pagination={{
            current: urlState.pageNum,
            pageSize: urlState.pageSize,
            total,
            showTotal: (value) => `共 ${value} 条`,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          onChange={(pagination) => {
            updateUrl({
              pageNum: pagination.current || 1,
              pageSize: pagination.pageSize || 20,
            });
          }}
        />
      </div>
    </div>
  );
}

export default function CdnLogsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Spin /></div>}>
      <PageContent />
    </Suspense>
  );
}
