/**
 * 权限码管理页面
 * 路由: /c/permissions
 */

"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { Tag, message, Card, Input, Select, Empty } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const { Search } = Input;

interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
  type: string;
  description: string | null;
  status: number;
  sort_order: number;
}

const MODULE_LABELS: Record<string, string> = {
  post: "文章",
  comment: "评论",
  collection: "合集",
  config: "配置",
  user: "用户",
};

const TYPE_LABELS: Record<string, string> = {
  api: "API",
  menu: "菜单",
  button: "按钮",
};

const MODULE_COLORS: Record<string, string> = {
  post: "blue",
  comment: "green",
  collection: "purple",
  config: "orange",
  user: "red",
};

function PermissionsPageContent() {
  const { isMobile } = useBreakpoint();

  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  /**
   * 加载权限码列表
   */
  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (moduleFilter !== "all") {
        params.module = moduleFilter;
      }
      const response = await axios.get("/api/admin/permissions", { params });
      if (response.data.status) {
        const data = response.data.data;
        setPermissions(data.list || []);
        setModules(data.modules || []);
      }
    } catch (error) {
      console.error("加载权限码失败:", error);
      message.error("加载权限码失败");
    } finally {
      setLoading(false);
    }
  }, [moduleFilter]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  /**
   * 过滤权限列表
   */
  const filteredPermissions = permissions.filter(p => {
    if (!searchText) return true;
    const keyword = searchText.toLowerCase();
    return (
      p.code.toLowerCase().includes(keyword) ||
      p.name.toLowerCase().includes(keyword) ||
      (p.description && p.description.toLowerCase().includes(keyword))
    );
  });

  /**
   * 按模块分组（过滤后）
   */
  const filteredGrouped: Record<string, PermissionItem[]> = {};
  for (const perm of filteredPermissions) {
    if (!filteredGrouped[perm.module]) {
      filteredGrouped[perm.module] = [];
    }
    filteredGrouped[perm.module].push(perm);
  }
  const displayModules = Object.keys(filteredGrouped).sort();

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 标题栏 */}
        <AdminPageHeader
          title="权限管理"
          tag={<Tag color="blue">{permissions.length} 个权限码</Tag>}
        />

        {/* 搜索和筛选 */}
        <div className={`mb-4 shrink-0 ${isMobile ? "flex flex-col gap-2" : "flex gap-4"}`}>
          <Search
            placeholder="搜索权限码或名称"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={isMobile ? { width: "100%" } : { maxWidth: 400 }}
          />
          <Select
            placeholder="模块筛选"
            allowClear
            size="middle"
            style={isMobile ? { width: "100%" } : { width: 140 }}
            value={moduleFilter === "all" ? undefined : moduleFilter}
            onChange={(value) => setModuleFilter(value || "all")}
            options={[
              { label: "全部模块", value: "all" },
              ...modules.map(m => ({
                label: MODULE_LABELS[m] || m,
                value: m,
              })),
            ]}
          />
        </div>

        {/* 权限列表（按模块分组） */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div>加载中...</div>
            </div>
          ) : displayModules.length === 0 ? (
            <Empty description="暂无权限码" />
          ) : (
            <div className="space-y-4">
              {displayModules.map(module => (
                <Card
                  key={module}
                  size="small"
                  title={
                    <div className="flex items-center gap-2">
                      <Tag color={MODULE_COLORS[module] || "default"}>
                        {MODULE_LABELS[module] || module}
                      </Tag>
                      <span className="text-sm text-gray-500">
                        {filteredGrouped[module].length} 个权限
                      </span>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {filteredGrouped[module].map(perm => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Tag className="font-mono text-xs shrink-0">
                            {perm.code}
                          </Tag>
                          <span className="font-medium shrink-0">{perm.name}</span>
                          {perm.description && (
                            <span className="text-gray-400 text-sm truncate">
                              {perm.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Tag color={perm.type === "api" ? "blue" : perm.type === "menu" ? "green" : "orange"}>
                            {TYPE_LABELS[perm.type] || perm.type}
                          </Tag>
                          <Tag color={perm.status === 1 ? "success" : "default"}>
                            {perm.status === 1 ? "启用" : "禁用"}
                          </Tag>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PermissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div>加载中...</div>
        </div>
      }
    >
      <PermissionsPageContent />
    </Suspense>
  );
}
