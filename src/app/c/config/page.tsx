/**
 * 配置管理页面
 * 路由: /c/config
 * 三个 Tab：单项配置 | AI 供应商 | 场景绑定
 */

"use client";

import React, { Suspense, useState } from "react";
import { Tabs } from "antd";
import ConfigListTab from "./ConfigListTab";
import ProviderTab from "./ProviderTab";
import BindingTab from "./BindingTab";
import {
  AdminPageHeader,
} from "@/components/admin/AdminPageHeader";

const TAB_ITEMS = [
  {
    key: "config",
    label: "单项配置",
    children: <ConfigListTab />,
  },
  {
    key: "provider",
    label: "AI 供应商",
    children: <ProviderTab />,
  },
  {
    key: "binding",
    label: "场景绑定",
    children: <BindingTab />,
  },
];

const CONFIG_TABS_CLASS_NAME = [
  "flex-1 min-h-0",
  "[&_.ant-tabs-nav]:shrink-0",
  "[&_.ant-tabs-content-holder]:flex-1",
  "[&_.ant-tabs-content-holder]:min-h-0",
  "[&_.ant-tabs-content-holder]:overflow-hidden",
  "[&_.ant-tabs-content]:h-full",
  "[&_.ant-tabs-content]:min-h-0",
  "[&_.ant-tabs-tabpane]:h-full",
  "[&_.ant-tabs-tabpane]:min-h-0",
  "[&_.ant-tabs-tabpane]:overflow-hidden",
].join(" ");

function ConfigPageContent() {
  const [activeTab, setActiveTab] = useState("config");

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <AdminPageHeader title="配置管理" />
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={TAB_ITEMS}
          className={CONFIG_TABS_CLASS_NAME}
        />
      </div>
    </div>
  );
}

export default function ConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div>加载中...</div>
        </div>
      }
    >
      <ConfigPageContent />
    </Suspense>
  );
}
