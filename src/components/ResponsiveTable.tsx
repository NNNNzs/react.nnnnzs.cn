/**
 * 响应式表格组件
 * 桌面端渲染 Ant Design Table，移动端渲染卡片列表
 * 内置 useBreakpoint + ResizeObserver 自动处理
 */

"use client";

import React, { useRef, useEffect, useState } from "react";
import { Empty, Pagination, Spin, Table } from "antd";
import type { TableProps, TableColumnsType } from "antd";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const MOBILE_BREAKPOINT = 768;

export interface ResponsiveTableProps<T extends object = Record<string, unknown>>
  extends Omit<TableProps<T>, "columns"> {
  /** 桌面端表格列定义 */
  columns: TableColumnsType<T>;
  /** 移动端卡片渲染函数 */
  renderMobileCard: (record: T) => React.ReactNode;
  /** 移动端断点，默认 768 */
  mobileBreakpoint?: number;
}

export default function ResponsiveTable<T extends object = Record<string, unknown>>({
  columns,
  dataSource,
  renderMobileCard,
  mobileBreakpoint = MOBILE_BREAKPOINT,
  pagination,
  loading,
  onChange,
  scroll,
  rowKey,
  ...rest
}: ResponsiveTableProps<T>) {
  const { isMobile } = useBreakpoint(mobileBreakpoint);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollHeight, setTableScrollHeight] = useState<
    number | undefined
  >(undefined);

  // 桌面端：动态计算表格滚动高度
  useEffect(() => {
    if (isMobile) return;

    const updateScrollHeight = () => {
      if (tableContainerRef.current) {
        const containerHeight = tableContainerRef.current.clientHeight;
        if (containerHeight > 0) {
          // 减去分页器（约64px）+ 表格头部（约40px）
          const height = containerHeight - 104;
          setTableScrollHeight(Math.max(height, 300));
        }
      }
    };

    updateScrollHeight();

    const observer = new ResizeObserver(updateScrollHeight);
    if (tableContainerRef.current) {
      observer.observe(tableContainerRef.current);
    }

    let timer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(updateScrollHeight, 100);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [isMobile]);

  // 移动端分页简化配置
  const mobilePagination = pagination
    ? {
        current: pagination.current ?? 1,
        pageSize: pagination.pageSize ?? 20,
        total: pagination.total ?? 0,
        showTotal: pagination.showTotal
          ? pagination.showTotal
          : (total: number) => `共 ${total} 条`,
        size: "small" as const,
        onChange: pagination.onChange,
      }
    : false;

  // 桌面端 scroll 配置：优先用外部传入，否则用自动计算的
  const desktopScroll = scroll
    ? scroll
    : tableScrollHeight
      ? { y: tableScrollHeight }
      : undefined;
  const records = Array.from(dataSource ?? []);

  const getMobileRecordKey = (record: T, index: number): React.Key => {
    if (typeof rowKey === "function") {
      return rowKey(record, index);
    }
    if (typeof rowKey === "string" && rowKey in record) {
      return record[rowKey as keyof T] as React.Key;
    }
    return (record as { key?: React.Key }).key ?? index;
  };
  const handleMobilePaginationChange = (page: number, pageSize: number) => {
    if (!pagination) return;

    pagination.onChange?.(page, pageSize);
    onChange?.(
      {
        ...pagination,
        current: page,
        pageSize,
      },
      {} as Parameters<NonNullable<TableProps<T>["onChange"]>>[1],
      {} as Parameters<NonNullable<TableProps<T>["onChange"]>>[2],
      {
        currentDataSource: records,
        action: "paginate",
      } as Parameters<NonNullable<TableProps<T>["onChange"]>>[3],
    );
  };

  if (isMobile) {
    return (
      <div className="flex-1 overflow-auto px-1">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spin />
          </div>
        ) : records.length > 0 ? (
          <div className="space-y-3">
            {records.map((record, index) => (
              <div key={getMobileRecordKey(record, index)}>
                {renderMobileCard(record)}
              </div>
            ))}
          </div>
        ) : (
          <Empty className="py-10" description="暂无数据" />
        )}

        {mobilePagination && records.length > 0 && (
          <div className="flex justify-center py-3">
            <Pagination
              {...mobilePagination}
              onChange={handleMobilePaginationChange}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={tableContainerRef} className="flex-1 flex flex-col min-h-0">
      <Table<T>
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        loading={loading}
        scroll={desktopScroll}
        pagination={pagination}
        onChange={onChange}
        {...rest}
      />
    </div>
  );
}
